/**
 * scripts/smoke.ts
 *
 * Smoke test verifying real Stellar Testnet contract execution:
 * 1. Auto-executed payment: Agent proposes valid payment <= per_tx_cap to allowlisted provider -> Executed immediately.
 * 2. Pending payment: Agent proposes payment > per_tx_cap to provider -> enqueued as Pending.
 * 3. Human approval: Owner approves the pending proposal -> Executed immediately.
 * 4. Balance assertions: Provider receives exact funds; Vault balance decrements accurately.
 * 5. Saves proof and explorer links to evidence/smoke.json.
 */

import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  Keypair,
  Networks,
  rpc,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk';
import { Client, networks, Status } from 'vault-client';

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
const rpcServer = new rpc.Server(RPC_URL);

function getSecret(alias: string): string {
  return execSync(`stellar keys secret ${alias}`, { encoding: 'utf-8' }).trim();
}

function getKeypair(alias: string): Keypair {
  return Keypair.fromSecret(getSecret(alias));
}

function getAddress(alias: string): string {
  return execSync(`stellar keys address ${alias}`, { encoding: 'utf-8' }).trim();
}

function getSacBalance(sacId: string, address: string): bigint {
  const out = execSync(
    `stellar contract invoke --id ${sacId} --source av-owner --network testnet -- balance --id ${address}`,
    { encoding: 'utf-8' }
  );
  const raw = out.trim().split('\n').pop()?.replace(/"/g, '') || '0';
  return BigInt(raw);
}

async function main() {
  console.log('=====================================================');
  console.log('🧪 AgentVault v2 — Stellar Testnet Smoke Test');
  console.log('=====================================================\n');

  const evidencePath = path.resolve('evidence', 'deployment.json');
  if (!fs.existsSync(evidencePath)) {
    throw new Error('evidence/deployment.json not found! Run deploy first.');
  }
  const deployment = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));

  const vaultId = deployment.contracts.vault;
  const sacId = deployment.contracts.token_sac;
  const ownerAddress = deployment.accounts.owner;
  const agentAddress = deployment.accounts.agent;
  const providerAddress = deployment.accounts.provider;

  console.log(`Vault Contract:    ${vaultId}`);
  console.log(`SAC Token:         ${sacId}`);
  console.log(`Owner:             ${ownerAddress}`);
  console.log(`Agent:             ${agentAddress}`);
  console.log(`Provider:          ${providerAddress}\n`);

  // Initial balance checks
  const initialVaultBal = getSacBalance(sacId, vaultId);
  const initialProviderBal = getSacBalance(sacId, providerAddress);

  console.log(`Initial Vault Balance:    ${initialVaultBal} stroops (${Number(initialVaultBal) / 1e7} TUSDC)`);
  console.log(`Initial Provider Balance: ${initialProviderBal} stroops (${Number(initialProviderBal) / 1e7} TUSDC)\n`);

  // Verify client reads get_config
  const client = new Client({
    networkPassphrase: PASSPHRASE,
    contractId: vaultId,
    rpcUrl: RPC_URL,
  });

  const configSim = await client.get_config();
  console.log('Vault Config read via generated TypeScript bindings:');
  console.log(`- Owner: ${configSim.result.owner}`);
  console.log(`- Agent: ${configSim.result.agent}`);
  console.log(`- Per-Tx Cap: ${configSim.result.policy.per_tx_cap} stroops`);
  console.log(`- Daily Cap:  ${configSim.result.policy.daily_cap} stroops`);
  console.log(`- Allowlist:  ${JSON.stringify(configSim.result.allowlist)}\n`);

  // Helper to extract txHash from emitted contract events
  async function getEventTxHash(topic: string, id: bigint): Promise<string> {
    const latestLedger = (await rpcServer.getLatestLedger()).sequence;
    const evRes = await rpcServer.getEvents({
      startLedger: Math.max(1, latestLedger - 100),
      filters: [{ type: 'contract', contractIds: [vaultId] }],
      limit: 50,
    });
    for (const e of evRes.events) {
      const topics = e.topic.map((t) => scValToNative(t));
      if (topics[0] === topic && topics[1] === id) {
        return e.txHash;
      }
    }
    return '';
  }

  // Dynamically read next_id before test
  const startConfig = await client.get_config();
  const autoPropId = BigInt(startConfig.result.next_id);
  const pendingPropId = autoPropId + 1n;

  // -------------------------------------------------------------------------
  // SMOKE TEST 1: Auto-executed payment (1 TUSDC <= 5 TUSDC per-tx cap)
  // -------------------------------------------------------------------------
  console.log(`--- [Test 1] Auto-Executed Payment (1 TUSDC) [Proposal ID ${autoPropId}] ---`);
  const invoice1 = 'smoke-auto-invoice-' + Date.now();
  const reasonHash1 = crypto.createHash('sha256').update(invoice1).digest('hex');
  const amount1 = '10000000'; // 1 TUSDC

  console.log(`Proposing payment to allowlisted provider: amount = ${amount1} stroops...`);
  execSync(
    `stellar contract invoke --id ${vaultId} --source av-agent --network testnet --send=yes -- propose --to ${providerAddress} --amount ${amount1} --memo "smoke-auto-exec" --reason-hash ${reasonHash1}`,
    { encoding: 'utf-8' }
  );

  const autoTxHash = await getEventTxHash('executed', autoPropId);
  console.log(`✅ Auto-executed Propose Succeeded! Tx: ${autoTxHash}`);
  console.log(`🔗 Explorer: https://stellar.expert/explorer/testnet/tx/${autoTxHash}`);

  // Check balances after Test 1
  const post1VaultBal = getSacBalance(sacId, vaultId);
  const post1ProviderBal = getSacBalance(sacId, providerAddress);
  console.log(`Vault Balance:    ${post1VaultBal} (Expected: ${initialVaultBal - 10000000n})`);
  console.log(`Provider Balance: ${post1ProviderBal} (Expected: ${initialProviderBal + 10000000n})\n`);

  // -------------------------------------------------------------------------
  // SMOKE TEST 2: Pending proposal (6 TUSDC > 5 TUSDC per-tx cap)
  // -------------------------------------------------------------------------
  console.log(`--- [Test 2] Over-Cap Payment -> Pending Queue (6 TUSDC) [Proposal ID ${pendingPropId}] ---`);
  const invoice2 = 'smoke-pending-invoice-' + Date.now();
  const reasonHash2 = crypto.createHash('sha256').update(invoice2).digest('hex');
  const amount2 = '60000000'; // 6 TUSDC (> 5 TUSDC cap)

  console.log(`Proposing over-cap payment: amount = ${amount2} stroops...`);
  execSync(
    `stellar contract invoke --id ${vaultId} --source av-agent --network testnet --send=yes -- propose --to ${providerAddress} --amount ${amount2} --memo "smoke-pending" --reason-hash ${reasonHash2}`,
    { encoding: 'utf-8' }
  );

  const pendingTxHash = await getEventTxHash('proposed', pendingPropId);
  console.log(`✅ Pending Proposal Created! Tx: ${pendingTxHash}`);
  console.log(`🔗 Explorer: https://stellar.expert/explorer/testnet/tx/${pendingTxHash}`);

  // -------------------------------------------------------------------------
  // SMOKE TEST 3: Owner Approval of Pending Proposal
  // -------------------------------------------------------------------------
  console.log(`\n--- [Test 3] Owner Approving Proposal ID ${pendingPropId} ---`);
  execSync(
    `stellar contract invoke --id ${vaultId} --source av-owner --network testnet --send=yes -- approve --id ${pendingPropId}`,
    { encoding: 'utf-8' }
  );

  const approveTxHash = await getEventTxHash('executed', pendingPropId);
  console.log(`✅ Proposal ${pendingPropId} Approved! Tx: ${approveTxHash}`);
  console.log(`🔗 Explorer: https://stellar.expert/explorer/testnet/tx/${approveTxHash}`);

  // Final Balance verification
  const finalVaultBal = getSacBalance(sacId, vaultId);
  const finalProviderBal = getSacBalance(sacId, providerAddress);
  console.log(`\nFinal Vault Balance:    ${finalVaultBal} (Expected: ${initialVaultBal - 70000000n})`);
  console.log(`Final Provider Balance: ${finalProviderBal} (Expected: ${initialProviderBal + 70000000n})`);

  if (finalVaultBal !== initialVaultBal - 70000000n) {
    throw new Error('Vault balance did not decrement by 7 TUSDC total!');
  }
  if (finalProviderBal !== initialProviderBal + 70000000n) {
    throw new Error('Provider balance did not increment by 7 TUSDC total!');
  }

  // Record smoke proof
  const smokeProof = {
    network: 'testnet',
    vault_contract: vaultId,
    token_sac: sacId,
    timestamp: new Date().toISOString(),
    flows: {
      auto_executed: {
        type: 'AUTO_EXECUTE',
        amount_stroops: amount1,
        amount_tusdc: '1.0',
        recipient: providerAddress,
        memo: 'smoke-auto-exec',
        tx_hash: autoTxHash,
        explorer_url: `https://stellar.expert/explorer/testnet/tx/${autoTxHash}`,
        status: 'Executed',
      },
      pending_approval: {
        type: 'HUMAN_APPROVAL',
        amount_stroops: amount2,
        amount_tusdc: '6.0',
        recipient: providerAddress,
        memo: 'smoke-pending',
        proposal_id: Number(pendingPropId),
        propose_tx_hash: pendingTxHash,
        propose_explorer_url: `https://stellar.expert/explorer/testnet/tx/${pendingTxHash}`,
        approve_tx_hash: approveTxHash,
        approve_explorer_url: `https://stellar.expert/explorer/testnet/tx/${approveTxHash}`,
        status: 'Executed',
      },
    },
    balances: {
      initial_vault_tusdc: (Number(initialVaultBal) / 1e7).toString(),
      initial_provider_tusdc: (Number(initialProviderBal) / 1e7).toString(),
      final_vault_tusdc: (Number(finalVaultBal) / 1e7).toString(),
      final_provider_tusdc: (Number(finalProviderBal) / 1e7).toString(),
      delta_vault_tusdc: '-7.0',
      delta_provider_tusdc: '+7.0',
    },
  };

  const smokePath = path.resolve('evidence', 'smoke.json');
  fs.writeFileSync(smokePath, JSON.stringify(smokeProof, null, 2));
  console.log(`\n🎉 Smoke test evidence written to ${smokePath}`);
}

main().catch((err) => {
  console.error('\n❌ Smoke test failed:', err);
  process.exit(1);
});
