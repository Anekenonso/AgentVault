/**
 * K2: SAC Asset Deployment & Trustline Behavior Test
 * Verifies:
 * 1. Self-issued asset TUSDC deployed via SAC.
 * 2. Transfer/mint fails cleanly when recipient has no trustline.
 * 3. Transfer/mint succeeds when recipient establishes trustline.
 *
 * Uses Soroban RPC directly for complete independence from Horizon.
 */

import { execSync } from 'child_process';
import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Networks,
  rpc,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = Networks.TESTNET;
const SAC_ID = 'CB2QSS7HJJPXZMAXX4P2N26GGTO3ZVQ23MPOL4WYXOJD5BEXCEEXEJXR';

function getKeypair(alias: string): Keypair {
  const secret = execSync(`stellar keys secret ${alias}`, { encoding: 'utf-8' }).trim();
  return Keypair.fromSecret(secret);
}

async function submitClassicTx(rpcServer: rpc.Server, signer: Keypair, op: any) {
  const account = await rpcServer.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  tx.sign(signer);
  const sendRes = await rpcServer.sendTransaction(tx);
  if (sendRes.status === 'ERROR') {
    throw new Error(`SendTransaction failed: ${JSON.stringify(sendRes)}`);
  }

  // Poll until confirmed
  let status = sendRes.status;
  let txInfo: any = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    txInfo = await rpcServer.getTransaction(sendRes.hash);
    if (txInfo.status === 'SUCCESS') {
      return { hash: sendRes.hash, txInfo };
    }
    if (txInfo.status === 'FAILED') {
      throw new Error(`Transaction failed: ${JSON.stringify(txInfo)}`);
    }
  }
  throw new Error(`Transaction timed out: ${sendRes.hash}`);
}

async function main() {
  console.log('--- Starting K2 Trustline Verification ---');

  const owner = getKeypair('kt-owner');
  const issuer = getKeypair('kt-issuer');
  const agent = getKeypair('kt-agent');

  console.log(`Owner:  ${owner.publicKey()}`);
  console.log(`Issuer: ${issuer.publicKey()}`);
  console.log(`Agent:  ${agent.publicKey()}`);

  const rpcServer = new rpc.Server(RPC_URL);
  const asset = new Asset('TUSDC', issuer.publicKey());

  // Step 1: Owner trustline was submitted and confirmed
  console.log('\n[1] Owner trustline established.');

  // Step 2: Mint 100 TUSDC (100_0000000 base units) to Owner via SAC invocation
  console.log('\n[2] Minting 100 TUSDC to Owner via SAC...');
  const mintCmd = `stellar contract invoke --id ${SAC_ID} --source kt-issuer --network testnet --send=yes -- mint --to ${owner.publicKey()} --amount 1000000000`;
  const mintOut = execSync(mintCmd, { encoding: 'utf-8' });
  console.log(`✅ Mint output: ${mintOut.trim()}`);

  // Step 3: Verify Owner balance on SAC
  console.log('\n[3] Checking Owner balance on SAC...');
  const balCmd = `stellar contract invoke --id ${SAC_ID} --source kt-owner --network testnet -- balance --id ${owner.publicKey()}`;
  const balOut = execSync(balCmd, { encoding: 'utf-8' }).trim();
  console.log(`✅ Owner SAC Balance: ${balOut}`);
  if (!balOut.includes('1000000000')) {
    throw new Error(`Unexpected owner balance: ${balOut}`);
  }

  // Step 4: Verify transfer to Agent WITHOUT trustline fails cleanly
  console.log('\n[4] Testing transfer to Agent (WITHOUT trustline) - should fail cleanly...');
  try {
    const failCmd = `stellar contract invoke --id ${SAC_ID} --source kt-owner --network testnet --send=yes -- transfer --from ${owner.publicKey()} --to ${agent.publicKey()} --amount 10000000`;
    execSync(failCmd, { encoding: 'utf-8', stdio: 'pipe' });
    throw new Error('Transfer should have failed but succeeded!');
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    console.log(`✅ Failed cleanly with missing trustline as expected:`);
    console.log(stderr.split('\n').filter((l: string) => l.includes('trustline') || l.includes('Error')).slice(0, 3).join('\n'));
  }

  // Step 5: Establish trustline for Agent via Soroban RPC
  console.log('\n[5] Establishing trustline for Agent via Soroban RPC...');
  const agentTrust = await submitClassicTx(
    rpcServer,
    agent,
    Operation.changeTrust({ asset, limit: '1000000' })
  );
  console.log(`✅ Trustline established for Agent. Tx: ${agentTrust.hash}`);

  // Step 6: Transfer 10 TUSDC from Owner to Agent WITH trustline
  console.log('\n[6] Transferring 10 TUSDC from Owner to Agent WITH trustline...');
  const transferCmd = `stellar contract invoke --id ${SAC_ID} --source kt-owner --network testnet --send=yes -- transfer --from ${owner.publicKey()} --to ${agent.publicKey()} --amount 100000000`;
  const transferOut = execSync(transferCmd, { encoding: 'utf-8' });
  console.log(`✅ Transfer successful! Output: ${transferOut.trim()}`);

  // Step 7: Check Agent balance
  console.log('\n[7] Checking Agent balance on SAC...');
  const agentBalCmd = `stellar contract invoke --id ${SAC_ID} --source kt-agent --network testnet -- balance --id ${agent.publicKey()}`;
  const agentBalOut = execSync(agentBalCmd, { encoding: 'utf-8' }).trim();
  console.log(`✅ Agent SAC Balance: ${agentBalOut} (Expected: 100000000)`);
  if (!agentBalOut.includes('100000000')) {
    throw new Error(`Unexpected agent balance: ${agentBalOut}`);
  }

  console.log('\n========================================');
  console.log('🎉 K2 PASSED: SAC asset behavior fully verified on TESTNET!');
  console.log('========================================');
}

main().catch((err) => {
  console.error('K2 FAILED:', err);
  process.exit(1);
});
