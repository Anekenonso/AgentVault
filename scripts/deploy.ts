/**
 * scripts/deploy.ts
 *
 * Automated, idempotent deployment script for AgentVault v2 on Stellar Testnet.
 * Fulfills Phase 3 (GATE 3) requirements:
 * 1. Generates and funds required accounts (av-owner, av-agent, av-issuer, av-attacker, av-provider) without printing secrets.
 * 2. Issues test asset TUSDC, sets trustlines (owner, provider, attacker), deploys SAC, mints to owner.
 * 3. Deploys AgentVault with atomic constructor args (owner, agent, token, policy).
 * 4. Configures allowlist = [provider].
 * 5. Deploys NaiveVault for removal test baseline.
 * 6. Funds both vaults from owner with equal amounts (50 TUSDC each).
 * 7. Writes comprehensive deployment record to evidence/deployment.json.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  Keypair,
  Asset,
  Operation,
  TransactionBuilder,
  Networks,
  rpc,
  Address,
  nativeToScVal,
} from '@stellar/stellar-sdk';

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const PASSPHRASE = process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
const rpcServer = new rpc.Server(RPC_URL);

const ACCOUNT_ALIASES = ['av-owner', 'av-agent', 'av-issuer', 'av-attacker', 'av-provider'] as const;
type AccountAlias = typeof ACCOUNT_ALIASES[number];

// Policy constants: 5 TUSDC per tx, 20 TUSDC daily, 1h TTL, 0 expiration
const POLICY = {
  per_tx_cap: '50000000',      // 5 TUSDC in stroops (7 decimals)
  daily_cap: '200000000',      // 20 TUSDC in stroops
  proposal_ttl_secs: 3600,     // 1 hour
  policy_expires_at: 0,        // never expires
};

const MINT_AMOUNT = '1000';    // 1,000 TUSDC
const VAULT_FUND_STROOPS = 500000000n; // 50 TUSDC

function getSecret(alias: string): string {
  return execSync(`stellar keys secret ${alias}`, { encoding: 'utf-8' }).trim();
}

function getKeypair(alias: string): Keypair {
  return Keypair.fromSecret(getSecret(alias));
}

function getAddress(alias: string): string {
  return execSync(`stellar keys address ${alias}`, { encoding: 'utf-8' }).trim();
}

function ensureAccount(alias: string): string {
  try {
    return getAddress(alias);
  } catch {
    console.log(`Generating & funding account ${alias}...`);
    execSync(`stellar keys generate ${alias} --fund --network testnet`, { encoding: 'utf-8' });
    return getAddress(alias);
  }
}

async function submitClassicTx(signer: Keypair, op: any, desc: string): Promise<string> {
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
    throw new Error(`SendTransaction failed for ${desc}: ${JSON.stringify(sendRes)}`);
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const txInfo = await rpcServer.getTransaction(sendRes.hash);
    if (txInfo.status === 'SUCCESS') {
      console.log(`✅ [${desc}] Tx: ${sendRes.hash}`);
      return sendRes.hash;
    }
    if (txInfo.status === 'FAILED') {
      throw new Error(`Tx failed for ${desc}: ${JSON.stringify(txInfo)}`);
    }
  }
  throw new Error(`Tx timed out for ${desc}: ${sendRes.hash}`);
}

async function getClassicTokenBalance(accountPubkey: string, assetCode: string, issuerPubkey: string): Promise<number> {
  try {
    const acc = await rpcServer.getAccount(accountPubkey);
    for (const b of (acc as any).balances || []) {
      if (b.asset_code === assetCode && b.asset_issuer === issuerPubkey) {
        return parseFloat(b.balance);
      }
    }
    return -1; // Trustline missing
  } catch {
    return -1;
  }
}

async function main() {
  console.log('=====================================================');
  console.log('🚀 AgentVault v2 — Automated Testnet Deployment');
  console.log('=====================================================\n');

  // Step 1: Ensure identities exist and are funded with XLM
  console.log('--- [1/6] Verifying Identities ---');
  const accounts: Record<AccountAlias, string> = {} as any;
  for (const alias of ACCOUNT_ALIASES) {
    accounts[alias] = ensureAccount(alias);
    console.log(`Account ${alias.padEnd(12)}: ${accounts[alias]}`);
  }

  const ownerKp = getKeypair('av-owner');
  const issuerKp = getKeypair('av-issuer');
  const providerKp = getKeypair('av-provider');
  const attackerKp = getKeypair('av-attacker');

  // Step 2: Establish Asset and Trustlines
  console.log('\n--- [2/6] Asset & Trustlines ---');
  const asset = new Asset('TUSDC', accounts['av-issuer']);
  console.log(`Asset identifier: TUSDC:${accounts['av-issuer']}`);

  const trustlinesToSetup: [AccountAlias, Keypair][] = [
    ['av-owner', ownerKp],
    ['av-provider', providerKp],
    ['av-attacker', attackerKp],
  ];

  const trustlineTxs: Record<string, string> = {};
  for (const [alias, kp] of trustlinesToSetup) {
    const bal = await getClassicTokenBalance(accounts[alias], 'TUSDC', accounts['av-issuer']);
    if (bal < 0) {
      console.log(`Establishing trustline for ${alias}...`);
      const hash = await submitClassicTx(
        kp,
        Operation.changeTrust({ asset, limit: '1000000000' }),
        `changeTrust for ${alias}`
      );
      trustlineTxs[alias] = hash;
    } else {
      console.log(`Trustline already active for ${alias} (Balance: ${bal} TUSDC)`);
    }
  }

  // Step 3: Mint TUSDC to av-owner
  console.log('\n--- [3/6] Minting TUSDC to av-owner ---');
  let ownerBal = await getClassicTokenBalance(accounts['av-owner'], 'TUSDC', accounts['av-issuer']);
  let mintTx = '';
  if (ownerBal < 200) {
    console.log(`Minting ${MINT_AMOUNT} TUSDC to av-owner...`);
    mintTx = await submitClassicTx(
      issuerKp,
      Operation.payment({
        destination: accounts['av-owner'],
        asset,
        amount: MINT_AMOUNT,
      }),
      'mint TUSDC to av-owner'
    );
    ownerBal = await getClassicTokenBalance(accounts['av-owner'], 'TUSDC', accounts['av-issuer']);
  }
  console.log(`av-owner TUSDC balance: ${ownerBal}`);

  // Step 4: SAC Contract Deployment
  console.log('\n--- [4/6] Stellar Asset Contract (SAC) ---');
  let sacId = '';
  try {
    sacId = execSync(
      `stellar contract id asset --asset TUSDC:${accounts['av-issuer']} --network testnet`,
      { encoding: 'utf-8' }
    ).trim();
    console.log(`Derived SAC Contract ID: ${sacId}`);
  } catch (err: any) {
    throw new Error(`Failed to derive SAC ID: ${err.message}`);
  }

  // Check if SAC is deployed on-chain
  let sacDeployTx = '';
  try {
    const checkDecimals = execSync(
      `stellar contract invoke --id ${sacId} --source av-owner --network testnet -- decimals`,
      { encoding: 'utf-8' }
    );
    console.log(`SAC is deployed and responding (Decimals: ${checkDecimals.trim().split('\n').pop()})`);
  } catch {
    console.log(`Deploying SAC for TUSDC:${accounts['av-issuer']}...`);
    const out = execSync(
      `stellar contract asset deploy --asset TUSDC:${accounts['av-issuer']} --source av-issuer --network testnet`,
      { encoding: 'utf-8' }
    );
    console.log(out.trim());
  }

  // Step 5: Deploy Contracts (Vault & NaiveVault)
  console.log('\n--- [5/6] Deploying Smart Contracts ---');
  const tempPolicyPath = path.resolve('evidence', 'deployment-policy-temp.json');
  fs.writeFileSync(tempPolicyPath, JSON.stringify(POLICY, null, 2));

  // 5a. Deploy Vault
  let vaultId = '';
  const evidencePath = path.resolve('evidence', 'deployment.json');
  let existingDeployment: any = null;
  if (fs.existsSync(evidencePath)) {
    try {
      existingDeployment = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
    } catch {
      existingDeployment = null;
    }
  }

  // Check known active contracts or deploy new
  const KNOWN_VAULT = 'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';
  const KNOWN_NAIVE_VAULT = 'CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T';

  if (existingDeployment?.contracts?.vault) {
    vaultId = existingDeployment.contracts.vault;
    console.log(`Using existing Vault contract ID from deployment.json: ${vaultId}`);
  } else {
    // Check if KNOWN_VAULT is responding
    try {
      execSync(`stellar contract invoke --id ${KNOWN_VAULT} --source av-owner --network testnet -- get_config`, { encoding: 'utf-8' });
      vaultId = KNOWN_VAULT;
      console.log(`Reusing active Vault contract ID: ${vaultId}`);
    } catch {
      console.log('Deploying AgentVault contract with constructor policy...');
      const deployOut = execSync(
        `stellar contract deploy --wasm target/wasm32v1-none/release/agentvault_vault.wasm --source av-owner --network testnet -- --owner av-owner --agent av-agent --token ${sacId} --policy-file-path "${tempPolicyPath}"`,
        { encoding: 'utf-8' }
      );
      const lines = deployOut.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      vaultId = lines[lines.length - 1];
      console.log(`✅ Vault Deployed: ${vaultId}`);
    }
  }

  // Configure Vault Allowlist = [provider]
  console.log('\nConfiguring Vault allowlist...');
  try {
    const checkConfig = execSync(
      `stellar contract invoke --id ${vaultId} --source av-owner --network testnet -- get_config`,
      { encoding: 'utf-8' }
    );
    const configParsed = JSON.parse(checkConfig.trim().split('\n').pop() || '{}');
    if (!configParsed.allowlist || !configParsed.allowlist.includes(accounts['av-provider'])) {
      execSync(
        `stellar contract invoke --id ${vaultId} --source av-owner --network testnet --send=yes -- set_allowlist --list '["${accounts['av-provider']}"]'`,
        { encoding: 'utf-8' }
      );
      console.log(`✅ Allowlist configured with av-provider: ${accounts['av-provider']}`);
    } else {
      console.log(`✅ Allowlist already contains av-provider: ${accounts['av-provider']}`);
    }
  } catch (err: any) {
    console.log(`Notice on allowlist: ${err.message}`);
  }

  // 5b. Deploy NaiveVault
  let naiveVaultId = '';
  if (existingDeployment?.contracts?.naive_vault) {
    naiveVaultId = existingDeployment.contracts.naive_vault;
    console.log(`Using existing NaiveVault contract ID: ${naiveVaultId}`);
  } else {
    try {
      execSync(`stellar contract invoke --id ${KNOWN_NAIVE_VAULT} --source av-owner --network testnet -- balance`, { encoding: 'utf-8' });
      naiveVaultId = KNOWN_NAIVE_VAULT;
      console.log(`Reusing active NaiveVault contract ID: ${naiveVaultId}`);
    } catch {
      console.log('\nDeploying NaiveVault contract...');
      const deployNaiveOut = execSync(
        `stellar contract deploy --wasm target/wasm32v1-none/release/agentvault_naive_vault.wasm --source av-owner --network testnet -- --owner av-owner --agent av-agent --token ${sacId}`,
        { encoding: 'utf-8' }
      );
      const lines = deployNaiveOut.trim().split('\n').map((l) => l.trim()).filter(Boolean);
      naiveVaultId = lines[lines.length - 1];
      console.log(`✅ NaiveVault Deployed: ${naiveVaultId}`);
    }
  }

  // Clean up temp policy file
  if (fs.existsSync(tempPolicyPath)) {
    fs.unlinkSync(tempPolicyPath);
  }

  // Step 6: Fund both Vaults from av-owner
  console.log('\n--- [6/6] Funding Vaults ---');

  // Check vault balance
  const checkVaultBalCmd = `stellar contract invoke --id ${sacId} --source av-owner --network testnet -- balance --id ${vaultId}`;
  let currentVaultBal = 0n;
  try {
    const rawBal = execSync(checkVaultBalCmd, { encoding: 'utf-8' }).trim().split('\n').pop()?.replace(/"/g, '') || '0';
    currentVaultBal = BigInt(rawBal);
  } catch {
    currentVaultBal = 0n;
  }
  console.log(`Current Vault balance: ${currentVaultBal} stroops (${Number(currentVaultBal) / 1e7} TUSDC)`);

  if (currentVaultBal < VAULT_FUND_STROOPS) {
    const needed = VAULT_FUND_STROOPS - currentVaultBal;
    console.log(`Funding Vault with ${needed} stroops from av-owner...`);
    execSync(
      `stellar contract invoke --id ${sacId} --source av-owner --network testnet --send=yes -- transfer --from av-owner --to ${vaultId} --amount ${needed}`,
      { encoding: 'utf-8' }
    );
    console.log(`✅ Vault funded!`);
  }

  // Check naive vault balance
  const checkNaiveBalCmd = `stellar contract invoke --id ${sacId} --source av-owner --network testnet -- balance --id ${naiveVaultId}`;
  let currentNaiveBal = 0n;
  try {
    const rawBal = execSync(checkNaiveBalCmd, { encoding: 'utf-8' }).trim().split('\n').pop()?.replace(/"/g, '') || '0';
    currentNaiveBal = BigInt(rawBal);
  } catch {
    currentNaiveBal = 0n;
  }
  console.log(`Current NaiveVault balance: ${currentNaiveBal} stroops (${Number(currentNaiveBal) / 1e7} TUSDC)`);

  if (currentNaiveBal < VAULT_FUND_STROOPS) {
    const needed = VAULT_FUND_STROOPS - currentNaiveBal;
    console.log(`Funding NaiveVault with ${needed} stroops from av-owner...`);
    execSync(
      `stellar contract invoke --id ${sacId} --source av-owner --network testnet --send=yes -- transfer --from av-owner --to ${naiveVaultId} --amount ${needed}`,
      { encoding: 'utf-8' }
    );
    console.log(`✅ NaiveVault funded!`);
  }

  // Final verification of config
  console.log('\nVerifying Vault on-chain configuration...');
  const finalConfigOut = execSync(
    `stellar contract invoke --id ${vaultId} --source av-owner --network testnet -- get_config`,
    { encoding: 'utf-8' }
  );
  console.log(finalConfigOut.trim().split('\n').pop());

  // Record deployment artifact
  const deploymentRecord = {
    network: 'testnet',
    rpc_url: RPC_URL,
    network_passphrase: PASSPHRASE,
    deployed_at: new Date().toISOString(),
    accounts: {
      owner: accounts['av-owner'],
      agent: accounts['av-agent'],
      issuer: accounts['av-issuer'],
      provider: accounts['av-provider'],
      attacker: accounts['av-attacker'],
    },
    contracts: {
      token_sac: sacId,
      vault: vaultId,
      naive_vault: naiveVaultId,
    },
    policy: POLICY,
    funding_per_vault_stroops: VAULT_FUND_STROOPS.toString(),
    funding_per_vault_tusdc: (Number(VAULT_FUND_STROOPS) / 1e7).toString(),
    explorer_links: {
      token_sac: `https://stellar.expert/explorer/testnet/contract/${sacId}`,
      vault: `https://stellar.expert/explorer/testnet/contract/${vaultId}`,
      naive_vault: `https://stellar.expert/explorer/testnet/contract/${naiveVaultId}`,
    },
  };

  fs.writeFileSync(evidencePath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`\n🎉 Deployment record written to ${evidencePath}`);

  // Also update .env.local if present or create it
  const envLocalPath = path.resolve('.env.local');
  const envContent = [
    `NEXT_PUBLIC_STELLAR_NETWORK=TESTNET`,
    `NEXT_PUBLIC_STELLAR_RPC_URL=${RPC_URL}`,
    `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=${PASSPHRASE}`,
    `NEXT_PUBLIC_VAULT_CONTRACT_ID=${vaultId}`,
    `NEXT_PUBLIC_NAIVE_VAULT_CONTRACT_ID=${naiveVaultId}`,
    `NEXT_PUBLIC_TOKEN_SAC_ID=${sacId}`,
    `NEXT_PUBLIC_PROVIDER_ADDRESS=${accounts['av-provider']}`,
    `NEXT_PUBLIC_ATTACKER_ADDRESS=${accounts['av-attacker']}`,
    `STELLAR_AGENT_PUBLIC_KEY=${accounts['av-agent']}`,
    `STELLAR_OWNER_PUBLIC_KEY=${accounts['av-owner']}`,
  ].join('\n') + '\n';

  fs.writeFileSync(envLocalPath, envContent);
  console.log(`✅ Saved environment variables to ${envLocalPath}`);
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:', err);
  process.exit(1);
});
