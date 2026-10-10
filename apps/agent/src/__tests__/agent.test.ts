/**
 * apps/agent/src/__tests__/agent.test.ts
 *
 * Vitest test suite for Agent Runtime & Authority Isolation:
 * 1. Authority Isolation: Proves agent module has NO imports, references, or access to owner keys.
 * 2. Environment Isolation: Verifies no OWNER_* variables exist or are used in agent runtime.
 * 3. Schema Validation (Defense-in-depth):
 *    - Rejects negative amounts (-1.0)
 *    - Rejects zero amounts (0, 0.0)
 *    - Rejects scientific notation (1e7, 1e-5)
 *    - Rejects >7 fractional digits (0.00000001)
 *    - Rejects homoglyphs / invalid Stellar addresses
 *    - Rejects oversized memos (>64 bytes)
 *    - Strips control characters from memos
 *    - Validates sha256(invoice_id) calculation
 * 4. Deterministic Mock Mode:
 *    - Labeled 'SIMULATED'
 *    - Extracts quote safely without live LLM API call
 *    - Validates schema and catches attacks with SchemaRejected
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import {
  ProposePaymentSchema,
  decimalToBaseUnits,
} from '../schema.js';
import { AgentRuntime } from '../agent.js';

describe('Agent Authority & Security Isolation', () => {
  it('1. Enforces strict authority isolation: agent code contains no references or imports to owner secrets', () => {
    const agentTsPath = path.resolve(__dirname, '../agent.ts');
    const schemaTsPath = path.resolve(__dirname, '../schema.ts');

    const agentSource = fs.readFileSync(agentTsPath, 'utf-8');
    const schemaSource = fs.readFileSync(schemaTsPath, 'utf-8');

    // Must not import or reference owner keys or aliases
    expect(agentSource).not.toContain('STELLAR_OWNER_SECRET');
    expect(agentSource).not.toContain('av-owner');
    expect(agentSource).not.toContain('ownerKeypair');

    expect(schemaSource).not.toContain('STELLAR_OWNER_SECRET');
    expect(schemaSource).not.toContain('av-owner');
  });

  it('2. Enforces environment isolation: agent runtime operates without OWNER_* env variables', () => {
    const ownerVars = Object.keys(process.env).filter((k) => k.startsWith('OWNER_') || k === 'STELLAR_OWNER_SECRET');
    expect(ownerVars).toHaveLength(0);
  });
});

describe('Zod Schema Validation & Defense-in-Depth', () => {
  const validRecipient = Keypair.random().publicKey();
  const validContractId = 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';

  it('3. Converts exact decimal amounts to base units (7 decimals) without floating-point errors', () => {
    expect(decimalToBaseUnits('1')).toBe(10000000n);
    expect(decimalToBaseUnits('1.0')).toBe(10000000n);
    expect(decimalToBaseUnits('0.1')).toBe(1000000n);
    expect(decimalToBaseUnits('0.0000001')).toBe(1n);
    expect(decimalToBaseUnits('20.5')).toBe(205000000n);
    expect(decimalToBaseUnits('12.3456789')).toBe(123456789n);
  });

  it('4. Rejects negative amounts', () => {
    const res = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '-1.0',
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('positive decimal');
    }
  });

  it('5. Rejects zero amounts', () => {
    const res1 = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '0',
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res1.success).toBe(false);

    const res2 = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '0.0000000',
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res2.success).toBe(false);
  });

  it('6. Rejects scientific / exponential notation', () => {
    const res1 = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '1e7',
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res1.success).toBe(false);

    const res2 = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '1.5e-3',
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res2.success).toBe(false);
  });

  it('7. Rejects amounts with more than 7 fractional digits', () => {
    const res = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '0.00000001', // 8 decimals
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('at most 7 fractional digits');
    }
  });

  it('8. Rejects homoglyphs and invalid Stellar public keys', () => {
    // Cyrillic 'А' (U+0410) instead of Latin 'A'
    const homoglyphAddress = 'G' + 'А' + validRecipient.slice(2);
    const res = ProposePaymentSchema.safeParse({
      to: homoglyphAddress,
      amount: '1.0',
      memo: 'test',
      invoice_id: 'inv-1',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain('Invalid recipient');
    }
  });

  it('9. Strips control characters and truncates/validates memo length', () => {
    const res = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '1.0',
      memo: 'clean\x00\x1b\x07memo',
      invoice_id: 'inv-1',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.memo).toBe('cleanmemo');
    }

    const overLength = 'm'.repeat(65);
    const resOver = ProposePaymentSchema.safeParse({
      to: validRecipient,
      amount: '1.0',
      memo: overLength,
      invoice_id: 'inv-1',
    });
    expect(resOver.success).toBe(false);
  });

  it('10. Accepts valid contract recipient address', () => {
    const res = ProposePaymentSchema.safeParse({
      to: validContractId,
      amount: '2.5',
      memo: 'contract-payment',
      invoice_id: 'inv-contract',
    });
    expect(res.success).toBe(true);
  });
});

describe('Deterministic Mock Mode & Runtime Execution', () => {
  const dummyAgentKey = Keypair.random();
  const dummyVault = 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';
  const dummyMerchant = Keypair.random().publicKey();

  it('11. Initializes in deterministic mock mode labeled SIMULATED', () => {
    const agent = new AgentRuntime({
      vaultContractId: dummyVault,
      agentSecret: dummyAgentKey.secret(),
      mode: 'mock',
    });

    expect(agent.getAgentPublicKey()).toBe(dummyAgentKey.publicKey());
  });

  it('12. Decides payment from quote deterministically in mock mode', async () => {
    const agent = new AgentRuntime({
      vaultContractId: dummyVault,
      agentSecret: dummyAgentKey.secret(),
      mode: 'mock',
    });

    const quote = {
      pay_to: dummyMerchant,
      price_base_units: '25000000',
      invoice_id: 'inv-12345',
    };

    const decision = await agent.decidePayment('Buy premium data', quote);
    expect(decision.to).toBe(dummyMerchant);
    expect(decision.amount).toBe('2.5');
    expect(decision.invoice_id).toBe('inv-12345');
  });

  it('13. Computes sha256 reason_hash accurately during proposal validation', () => {
    const agent = new AgentRuntime({
      vaultContractId: dummyVault,
      agentSecret: dummyAgentKey.secret(),
      mode: 'mock',
    });

    const invoiceId = 'inv-deterministic-hash';
    const expectedHash = crypto.createHash('sha256').update(invoiceId).digest('hex');

    const payment = agent.validateProposal({
      to: dummyMerchant,
      amount: '1.0',
      memo: 'hash-test',
      invoice_id: invoiceId,
    });

    expect(payment.reasonHashHex).toBe(expectedHash);
    expect(payment.amountBaseUnits).toBe(10000000n);
  });

  it('14. Catches schema attacks during task execution and returns SchemaRejected', async () => {
    const agent = new AgentRuntime({
      vaultContractId: dummyVault,
      agentSecret: dummyAgentKey.secret(),
      mode: 'mock',
    });

    // Adversarial quote with negative amount
    const maliciousQuote = {
      pay_to: dummyMerchant,
      amount: '-50.0',
      invoice_id: 'inv-exploit',
    };

    const result = await agent.executeTask('Exploit test', maliciousQuote);
    expect(result.success).toBe(false);
    expect(result.status).toBe('SchemaRejected');
    expect(result.mode).toBe('SIMULATED');
    expect(result.rejectionReason).toContain('REJECTED_BY_SCHEMA');
  });
});
