/**
 * scripts/e2e-happy-path.ts
 *
 * Executes the complete Phase 4 end-to-end happy path flow on Stellar Testnet:
 * 1. Paid API starts locally (HTTP 402 paywall).
 * 2. Autonomous Agent requests premium data without payment -> receives HTTP 402 with invoice quote.
 * 3. Agent runtime processes quote through strict Zod validation and computes reason_hash.
 * 4. Agent signs and submits `propose` transaction to the live AgentVault contract on Testnet.
 * 5. Vault policy engine verifies allowlist, per-tx cap, and 23h bucket cap -> auto-executes payment.
 * 6. Agent presents on-chain tx hash + invoice ID to Paid API in redemption headers.
 * 7. Paid API verifies on-chain execution event via Soroban RPC and releases premium data (HTTP 200).
 * 8. Full trace and transaction evidence saved to evidence/e2e-happy-path.json.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { Networks, rpc } from '@stellar/stellar-sdk';
import { createPaidApiApp } from '../apps/paid-api/src/server.js';
import { AgentRuntime } from '../apps/agent/src/agent.js';

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const VAULT_ID = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID || 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';
const PROVIDER_ADDRESS = process.env.NEXT_PUBLIC_PROVIDER_ADDRESS || 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK';

async function main() {
  console.log('=====================================================');
  console.log('🚀 Phase 4: Agent & Paid API End-to-End Happy Path');
  console.log('=====================================================\n');

  const rpcServer = new rpc.Server(RPC_URL);

  // 1. Start Paid API server
  const PORT = 4022;
  const { app } = createPaidApiApp({
    priceBaseUnits: '10000000', // 1.0 TUSDC
    asset: 'TUSDC',
    payTo: PROVIDER_ADDRESS,
    vaultContract: VAULT_ID,
    network: 'testnet',
    maxAgeSeconds: 3600,
  }, rpcServer);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[Paid-API] Service listening on http://localhost:${PORT}`);

  try {
    const paidApiEndpoint = `http://localhost:${PORT}/data?q=soroban-alpha-index`;

    // 2. Initial request without payment -> Expect HTTP 402
    console.log(`\n[Agent] Requesting ${paidApiEndpoint} without payment headers...`);
    const initialRes = await fetch(paidApiEndpoint);
    console.log(`[Paid-API] Response status: ${initialRes.status} (${initialRes.statusText})`);
    
    if (initialRes.status !== 402) {
      throw new Error(`Expected HTTP 402, received ${initialRes.status}`);
    }

    const quote402 = await initialRes.json();
    console.log('[Agent] Received HTTP 402 Payment Quote:');
    console.log(JSON.stringify(quote402, null, 2));

    // 3. Initialize Agent Runtime
    const agent = new AgentRuntime({
      vaultContractId: VAULT_ID,
      rpcUrl: RPC_URL,
      networkPassphrase: Networks.TESTNET,
      agentAlias: 'av-agent',
      mode: 'mock', // Deterministic quote processing for CI/testnet verification
    });

    console.log(`\n[Agent] Key public address: ${agent.getAgentPublicKey()}`);
    console.log('[Agent] Deciding and validating payment parameters...');

    const rawDecision = await agent.decidePayment('Fetch real-time Soroban alpha index', quote402);
    const validated = agent.validateProposal(rawDecision);
    console.log(`[Agent] Validated proposal:`);
    console.log(`  To: ${validated.to}`);
    console.log(`  Amount: ${validated.amountBaseUnits} base units (1.0 TUSDC)`);
    console.log(`  Memo: "${validated.memo}"`);
    console.log(`  Invoice ID: ${validated.invoiceId}`);
    console.log(`  Reason Hash: ${validated.reasonHashHex}`);

    // 4. Submit proposal to Testnet Vault
    console.log('\n[Agent] Submitting `propose` transaction to live AgentVault on Testnet...');
    const proposeResult = await agent.submitPropose(validated);
    console.log(`[Vault] Transaction submitted!`);
    console.log(`  Status: ${proposeResult.status}`);
    console.log(`  Proposal ID: ${proposeResult.proposalId}`);
    console.log(`  Tx Hash: ${proposeResult.txHash}`);
    console.log(`  Explorer URL: https://stellar.expert/explorer/testnet/tx/${proposeResult.txHash}`);

    if (proposeResult.status !== 'Executed') {
      throw new Error(`Expected payment to be Auto-Executed, but was ${proposeResult.status}`);
    }

    // 5. Present proof of payment to Paid API
    console.log('\n[Agent] Presenting payment proof to Paid API...');
    const redeemRes = await fetch(paidApiEndpoint, {
      headers: {
        'X-Payment-Tx': proposeResult.txHash,
        'X-Invoice': validated.invoiceId,
      },
    });

    console.log(`[Paid-API] Response status: ${redeemRes.status} (${redeemRes.statusText})`);
    if (redeemRes.status !== 200) {
      const errBody = await redeemRes.text();
      throw new Error(`Payment redemption failed with status ${redeemRes.status}: ${errBody}`);
    }

    const payload = await redeemRes.json();
    console.log('[Paid-API] Payment verified on Soroban Testnet! Released data:');
    console.log(JSON.stringify(payload, null, 2));

    // 6. Record evidence
    const evidence = {
      network: 'testnet',
      timestamp: new Date().toISOString(),
      label: 'TESTNET',
      experiment: 'GATE_4_E2E_HAPPY_PATH',
      vault_contract: VAULT_ID,
      provider_pay_to: PROVIDER_ADDRESS,
      agent_key: agent.getAgentPublicKey(),
      invoice_id: validated.invoiceId,
      reason_hash: validated.reasonHashHex,
      price_base_units: quote402.price_base_units,
      tx_hash: proposeResult.txHash,
      explorer_url: `https://stellar.expert/explorer/testnet/tx/${proposeResult.txHash}`,
      execution_status: proposeResult.status,
      paid_api_response: payload,
    };

    const evidencePath = path.resolve('evidence', 'e2e-happy-path.json');
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), 'utf-8');
    console.log(`\n✅ Evidence successfully written to ${evidencePath}`);

  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error during end-to-end happy path execution:', err);
  process.exit(1);
});
