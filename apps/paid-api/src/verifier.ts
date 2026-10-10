/**
 * apps/paid-api/src/verifier.ts
 *
 * Core on-chain verification engine for Paid API micropayments.
 * Verifies that an executed Soroban transaction satisfies all HTTP 402 requirements:
 * 1. Transaction exists on-chain and succeeded (SUCCESS).
 * 2. Emitted by the designated vault contract.
 * 3. Emits an 'executed' event with to == pay_to.
 * 4. Transferred amount >= price_base_units.
 * 5. Event reason_hash == sha256(invoice_id) (cryptographic rationale binding).
 * 6. Transaction is not replayed (unredeemed invoice and tx hash).
 * 7. Transaction is fresh (not older than maxAgeSeconds).
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { rpc, scValToNative, Address, StrKey } from '@stellar/stellar-sdk';

export interface PaidApiConfig {
  priceBaseUnits: string;   // e.g. "10000000" (1 TUSDC)
  asset: string;            // e.g. "TUSDC:G..."
  payTo: string;            // Merchant address (av-provider)
  vaultContract: string;    // Deployed AgentVault contract ID
  network: string;          // "testnet"
  maxAgeSeconds: number;    // e.g. 900 (15 min)
  storePath?: string;       // Path to redeemed store JSON
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  code?: string;
  amount?: string;
  txHash?: string;
  ledger?: number;
}

function normalizeContractAddress(cId: any): string {
  if (!cId) return '';
  if (cId.value && (cId.value instanceof Uint8Array || Buffer.isBuffer(cId.value))) {
    return StrKey.encodeContract(Buffer.from(cId.value));
  }
  if (Buffer.isBuffer(cId) || cId instanceof Uint8Array) {
    return StrKey.encodeContract(Buffer.from(cId));
  }
  const s = cId.toString();
  if (s.startsWith('C') && s.length === 56) return s;
  try {
    const buf = Buffer.from(s, 'hex');
    if (buf.length === 32) {
      return StrKey.encodeContract(buf);
    }
  } catch {
    // fallback
  }
  return s;
}

export class PaymentVerifier {
  private redeemedInvoices = new Set<string>();
  private redeemedTxHashes = new Set<string>();
  private storeFile?: string;

  constructor(private config: PaidApiConfig) {
    if (config.storePath) {
      this.storeFile = path.resolve(config.storePath);
      this.loadStore();
    }
  }

  private loadStore() {
    if (this.storeFile && fs.existsSync(this.storeFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.storeFile, 'utf-8'));
        if (Array.isArray(raw.invoices)) raw.invoices.forEach((id: string) => this.redeemedInvoices.add(id));
        if (Array.isArray(raw.txHashes)) raw.txHashes.forEach((h: string) => this.redeemedTxHashes.add(h));
      } catch (e) {
        console.warn('Failed to parse redeemed invoices store:', e);
      }
    }
  }

  private saveStore() {
    if (this.storeFile) {
      try {
        const dir = path.dirname(this.storeFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          this.storeFile,
          JSON.stringify(
            {
              invoices: Array.from(this.redeemedInvoices),
              txHashes: Array.from(this.redeemedTxHashes),
            },
            null,
            2
          )
        );
      } catch (e) {
        console.warn('Failed to save redeemed invoices store:', e);
      }
    }
  }

  public isInvoiceRedeemed(invoiceId: string): boolean {
    return this.redeemedInvoices.has(invoiceId);
  }

  public isTxRedeemed(txHash: string): boolean {
    return this.redeemedTxHashes.has(txHash.toLowerCase());
  }

  public async verifyPayment(
    txHash: string,
    invoiceId: string,
    rpcServer: rpc.Server
  ): Promise<VerificationResult> {
    const cleanHash = txHash?.trim().toLowerCase();
    const cleanInvoice = invoiceId?.trim();

    if (!cleanHash || cleanHash.length !== 64 || !/^[0-9a-f]{64}$/.test(cleanHash)) {
      return { valid: false, code: 'MALFORMED_HEADER', error: 'Invalid or missing X-Payment-Tx header' };
    }
    if (!cleanInvoice) {
      return { valid: false, code: 'MALFORMED_HEADER', error: 'Missing X-Invoice header' };
    }

    // 1. Check double spend / replay
    if (this.isInvoiceRedeemed(cleanInvoice)) {
      return { valid: false, code: 'INVOICE_ALREADY_REDEEMED', error: `Invoice ${cleanInvoice} has already been redeemed` };
    }
    if (this.isTxRedeemed(cleanHash)) {
      return { valid: false, code: 'TX_ALREADY_REDEEMED', error: `Payment transaction ${cleanHash} has already been redeemed` };
    }

    // 2. Fetch transaction from Soroban RPC
    let txInfo: any;
    try {
      txInfo = await rpcServer.getTransaction(cleanHash);
    } catch (err: any) {
      return { valid: false, code: 'RPC_ERROR', error: `Failed to query RPC for tx: ${err.message}` };
    }

    if (!txInfo || txInfo.status !== 'SUCCESS') {
      return {
        valid: false,
        code: 'TX_NOT_SUCCESSFUL',
        error: `Transaction status is '${txInfo?.status || 'NOT_FOUND'}', expected 'SUCCESS'`,
      };
    }

    // 3. Verify freshness
    const nowSecs = Math.floor(Date.now() / 1000);
    const txCreated = txInfo.createdAt || txInfo.latestLedgerCloseTime || nowSecs;
    if (nowSecs - txCreated > this.config.maxAgeSeconds) {
      return {
        valid: false,
        code: 'TX_TOO_OLD',
        error: `Transaction was created ${nowSecs - txCreated}s ago, exceeding max age of ${this.config.maxAgeSeconds}s`,
      };
    }

    // 4. Calculate expected reason hash
    const expectedReasonHex = crypto.createHash('sha256').update(cleanInvoice).digest('hex');

    // 5. Extract and decode events from transaction metadata or RPC getEvents
    let eventsToInspect: Array<{ contractId: string; topics: any[]; data: any }> = [];

    // Attempt 1: Direct contract events from RPC response
    if (txInfo.events?.contractEventsXdr && Array.isArray(txInfo.events.contractEventsXdr)) {
      const flattened = txInfo.events.contractEventsXdr.flat(3);
      for (const e of flattened) {
        if (!e) continue;
        const cId = normalizeContractAddress(e.contractId);
        const topics = (e.body?.value?.topics || []).map((sc: any) => {
          try { return scValToNative(sc); } catch { return sc; }
        });
        let data = e.body?.value?.data;
        try { data = scValToNative(data); } catch {}

        eventsToInspect.push({ contractId: cId, topics, data });
      }
    }

    if (txInfo.events?.transactionEventsXdr && Array.isArray(txInfo.events.transactionEventsXdr)) {
      for (const te of txInfo.events.transactionEventsXdr) {
        const e = te.event;
        if (!e) continue;
        const cId = normalizeContractAddress(e.contractId);
        const topics = (e.body?.value?.topics || []).map((sc: any) => {
          try { return scValToNative(sc); } catch { return sc; }
        });
        let data = e.body?.value?.data;
        try { data = scValToNative(data); } catch {}

        eventsToInspect.push({ contractId: cId, topics, data });
      }
    }

    // Attempt 2: Fall back to getEvents RPC call if no events found yet
    if (eventsToInspect.length === 0 && txInfo.ledger) {
      try {
        const evRes = await rpcServer.getEvents({
          startLedger: Math.max(1, txInfo.ledger - 10),
          filters: [{ type: 'contract', contractIds: [this.config.vaultContract] }],
          limit: 50,
        });
        for (const ev of evRes.events) {
          if (ev.txHash?.toLowerCase() === cleanHash) {
            const parsedTopics = (ev.topic || []).map((t: any) =>
              t && typeof t.switch === 'function' ? scValToNative(t) : t
            );
            const parsedData =
              ev.value && typeof ev.value.switch === 'function' ? scValToNative(ev.value) : ev.value;

            eventsToInspect.push({
              contractId: normalizeContractAddress(ev.contractId),
              topics: parsedTopics,
              data: parsedData,
            });
          }
        }
      } catch (err) {
        // Continue
      }
    }

    // 6. Look for matching 'executed' event
    // Event format emitted by Vault:
    // Topics: ["executed", proposal_id]
    // Data: [to: Address, amount: i128, reason_hash: BytesN<32>, auto: bool]
    let matchingEvent: any = null;
    let wrongRecipientFound = false;
    let insufficientAmountFound = false;
    let wrongReasonHashFound = false;

    for (const ev of eventsToInspect) {
      // Contract check
      if (ev.contractId && ev.contractId !== this.config.vaultContract) {
        continue;
      }

      // Check topic symbol
      const firstTopic = ev.topics?.[0];
      const topicSymbol = typeof firstTopic === 'string'
        ? firstTopic
        : (firstTopic?.symbol || firstTopic?.name || '');

      if (topicSymbol === 'executed') {
        const rawList = Array.isArray(ev.data) ? ev.data : (ev.data?.vec || []);
        if (Array.isArray(rawList) && rawList.length >= 3) {
          const rawTo = rawList[0];
          const toAddr = typeof rawTo === 'string' ? rawTo : (rawTo?.address || rawTo?.toString?.() || '');

          const rawAmt = rawList[1];
          const amountStr = typeof rawAmt === 'bigint' || typeof rawAmt === 'number'
            ? rawAmt.toString()
            : (rawAmt?.i128 || rawAmt?.u128 || rawAmt?.amount || rawAmt?.toString?.() || '0');
          const amount = BigInt(amountStr);

          const rawReason = rawList[2];
          let reasonHex = '';
          if (typeof rawReason === 'string') {
            reasonHex = rawReason;
          } else if (rawReason instanceof Uint8Array || Buffer.isBuffer(rawReason)) {
            reasonHex = Buffer.from(rawReason).toString('hex');
          } else if (rawReason?.bytes) {
            reasonHex = Buffer.from(rawReason.bytes).toString('hex');
          } else if (rawReason?.data) {
            reasonHex = Buffer.from(rawReason.data).toString('hex');
          }

          if (toAddr !== this.config.payTo) {
            wrongRecipientFound = true;
            continue;
          }

          if (amount < BigInt(this.config.priceBaseUnits)) {
            insufficientAmountFound = true;
            continue;
          }

          if (reasonHex !== expectedReasonHex) {
            wrongReasonHashFound = true;
            continue;
          }

          matchingEvent = { to: toAddr, amount, reasonHex, proposalId: ev.topics[1] };
          break;
        }
      }
    }

    if (!matchingEvent) {
      if (wrongRecipientFound) {
        return { valid: false, code: 'WRONG_RECIPIENT', error: `Payment was sent to wrong recipient, expected ${this.config.payTo}` };
      }
      if (insufficientAmountFound) {
        return { valid: false, code: 'AMOUNT_TOO_LOW', error: `Payment amount is below required price of ${this.config.priceBaseUnits} base units` };
      }
      if (wrongReasonHashFound) {
        return { valid: false, code: 'WRONG_REASON_HASH', error: `Payment reason_hash did not match sha256(invoice_id)` };
      }
      return {
        valid: false,
        code: 'NO_VALID_EXECUTED_EVENT',
        error: `Transaction did not emit a valid 'executed' event from vault ${this.config.vaultContract}`,
      };
    }

    // 7. Mark as redeemed
    this.redeemedInvoices.add(cleanInvoice);
    this.redeemedTxHashes.add(cleanHash);
    this.saveStore();

    return {
      valid: true,
      amount: matchingEvent.amount.toString(),
      txHash: cleanHash,
      ledger: txInfo.ledger,
    };
  }
}
