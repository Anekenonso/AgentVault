/**
 * scripts/verify-evidence.ts
 *
 * Verifies all on-chain evidence recorded in evidence/deployment.json and evidence/smoke.json:
 * 1. Queries Soroban RPC getTransaction for each transaction hash.
 * 2. Asserts on-chain status is SUCCESS.
 * 3. Extracts ledger sequence and close times.
 * 4. Fails the gate if any recorded hash is missing, unconfirmed, or failed.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Networks, rpc } from '@stellar/stellar-sdk';

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const rpcServer = new rpc.Server(RPC_URL);

interface TxCheckResult {
  file: string;
  label: string;
  hash: string;
  status: string;
  ledger?: number;
  latestLedgerCloseTime?: number;
}

async function verifyHash(file: string, label: string, hash: string): Promise<TxCheckResult> {
  if (!hash || hash.length !== 64) {
    return { file, label, hash, status: 'INVALID_HASH' };
  }

  try {
    const txInfo = await rpcServer.getTransaction(hash);
    return {
      file,
      label,
      hash,
      status: txInfo.status,
      ledger: (txInfo as any).ledger,
      latestLedgerCloseTime: (txInfo as any).latestLedgerCloseTime,
    };
  } catch (err: any) {
    return {
      file,
      label,
      hash,
      status: `RPC_ERROR: ${err.message}`,
    };
  }
}

async function main() {
  console.log('=====================================================');
  console.log('🔍 AgentVault v2 — Evidence Verification Suite');
  console.log('=====================================================\n');

  const checks: Promise<TxCheckResult>[] = [];

  // 1. Check deployment.json
  const deployPath = path.resolve('evidence', 'deployment.json');
  if (fs.existsSync(deployPath)) {
    const deploy = JSON.parse(fs.readFileSync(deployPath, 'utf-8'));
    if (deploy.transactions) {
      for (const [key, hash] of Object.entries(deploy.transactions)) {
        checks.push(verifyHash('deployment.json', `deploy:${key}`, hash as string));
      }
    }
  } else {
    console.warn('⚠️  evidence/deployment.json not found!');
  }

  // 2. Check smoke.json
  const smokePath = path.resolve('evidence', 'smoke.json');
  if (fs.existsSync(smokePath)) {
    const smoke = JSON.parse(fs.readFileSync(smokePath, 'utf-8'));
    if (smoke.flows?.auto_executed?.tx_hash) {
      checks.push(verifyHash('smoke.json', 'smoke:auto_executed', smoke.flows.auto_executed.tx_hash));
    }
    if (smoke.flows?.pending_approval?.propose_tx_hash) {
      checks.push(verifyHash('smoke.json', 'smoke:propose_pending', smoke.flows.pending_approval.propose_tx_hash));
    }
    if (smoke.flows?.pending_approval?.approve_tx_hash) {
      checks.push(verifyHash('smoke.json', 'smoke:approve_pending', smoke.flows.pending_approval.approve_tx_hash));
    }
  } else {
    console.warn('⚠️  evidence/smoke.json not found (will be checked if smoke has run)!');
  }

  if (checks.length === 0) {
    console.error('❌ No transaction hashes found to verify!');
    process.exit(1);
  }

  console.log(`Verifying ${checks.length} on-chain transaction hashes against Soroban RPC...\n`);
  const results = await Promise.all(checks);

  let allPassed = true;
  console.log('| Origin | Label | Transaction Hash | Status | Ledger |');
  console.log('|---|---|---|---|---|');
  for (const r of results) {
    const isOk = r.status === 'SUCCESS';
    if (!isOk) allPassed = false;
    const shortHash = `${r.hash.slice(0, 8)}...${r.hash.slice(-8)}`;
    console.log(`| ${r.file} | ${r.label} | ${shortHash} | ${r.status} | ${r.ledger ?? 'N/A'} |`);
  }

  console.log('');
  if (allPassed) {
    console.log(`🎉 ALL ${results.length} EVIDENCE TRANSACTIONS CONFIRMED ON TESTNET! (GATE PASSED)`);
    process.exit(0);
  } else {
    console.error('❌ ONE OR MORE EVIDENCE TRANSACTIONS FAILED VERIFICATION!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
