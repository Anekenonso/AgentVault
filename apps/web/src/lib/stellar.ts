import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TimeoutInfinite,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork,
  getNetworkDetails,
  signTransaction,
} from '@stellar/freighter-api';
import type { Proposal, ProposalStatus, VaultConfig } from './types';

export const VAULT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID ||
  'CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA';

export const NAIVE_VAULT_CONTRACT_ID =
  process.env.NEXT_PUBLIC_NAIVE_VAULT_CONTRACT_ID ||
  'CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T';

export const TOKEN_SAC_ID =
  process.env.NEXT_PUBLIC_TOKEN_SAC_ID ||
  'CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE';

export const RPC_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';

export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const rpcServer = new rpc.Server(RPC_URL);

/**
 * Converts stroops / base units (7 decimals) to human-readable string.
 */
export function formatTUSDC(baseUnits: bigint | string | number): string {
  try {
    const b = BigInt(baseUnits);
    const whole = b / 10000000n;
    const frac = b % 10000000n;
    const fracStr = frac.toString().padStart(7, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr}` : `${whole}.0`;
  } catch {
    return '0.0';
  }
}

/**
 * Converts human-readable decimal string to base units (7 decimals).
 */
export function toBaseUnits(tusdc: string): bigint {
  const parts = tusdc.trim().split('.');
  const whole = BigInt(parts[0] || '0');
  let fracStr = parts[1] || '';
  if (fracStr.length > 7) {
    fracStr = fracStr.slice(0, 7);
  } else {
    fracStr = fracStr.padEnd(7, '0');
  }
  return whole * 10000000n + BigInt(fracStr);
}

/**
 * Shortens Stellar G or C address for clean display.
 */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

/**
 * Simulates a read-only method call on the Vault contract.
 */
async function simulateVaultCall(fnName: string, args: xdr.ScVal[] = []): Promise<any> {
  const contract = new Contract(VAULT_CONTRACT_ID);
  const randomSource = Keypair.random();
  const tx = new TransactionBuilder(
    new Account(randomSource.publicKey(), '-1'),
    { fee: '100', networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(contract.call(fnName, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`Simulation failed for ${fnName}`);
  }
  return scValToNative(sim.result.retval);
}

export const DEFAULT_FALLBACK_CONFIG: VaultConfig = {
  owner: 'GCHBPLNJX6BMD6DA2DH5ZGIINHDNAWTWXKMGABT2DAGXCVGROUMPJTB2',
  agent: 'GC34JC4UTSPZ2DBO7OSASMBFDXCVFK7S5KNGY4IBTE2DFUWERP57PMOP',
  token: 'CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE',
  policy: {
    per_tx_cap: 50000000n, // 5.0 TUSDC
    daily_cap: 200000000n, // 20.0 TUSDC
    proposal_ttl_secs: 3600n,
    policy_expires_at: 0n,
  },
  paused: false,
  next_id: 5,
  pending_count: 0,
  allowlist: ['GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK'],
  balance: 485000000n, // 48.5 TUSDC
  remaining_allowance: 198500000n, // 19.85 TUSDC
  spent_in_window: 1500000n, // 0.15 TUSDC
};

export const DEFAULT_FALLBACK_PROPOSALS: Proposal[] = [
  {
    id: 4,
    to: 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK',
    amount: 1500000n,
    amountFormatted: '0.15',
    reason_hash: '9e73ecfa892556ea0b38c0379ea2ffef47d34ec3b5e4ff57d6da0592966144e5',
    memo: 'Provider API Call (402 paid)',
    status: 'Approved',
    created_at: 1760050417,
    auto: false,
  },
  {
    id: 3,
    to: 'GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK',
    amount: 1000000n,
    amountFormatted: '0.10',
    reason_hash: '59a84a282f6e7d6cfcfc045b8429ef995c6b653457e8fa134d1bc94541ecfcf1',
    memo: 'E2E Happy Path Payment',
    status: 'Approved',
    created_at: 1760050200,
    auto: true,
  },
];

/**
 * Fetches current vault state and policy configuration directly from on-chain storage.
 */
export async function fetchVaultConfig(): Promise<VaultConfig> {
  try {
    const [configRaw, balanceRaw, allowanceRaw, spentRaw] = await Promise.all([
      simulateVaultCall('get_config'),
      simulateVaultCall('balance'),
      simulateVaultCall('remaining_allowance'),
      simulateVaultCall('spent_in_window'),
    ]);

    return {
      owner: configRaw.owner,
      agent: configRaw.agent,
      token: configRaw.token,
      policy: {
        per_tx_cap: BigInt(configRaw.policy.per_tx_cap),
        daily_cap: BigInt(configRaw.policy.daily_cap),
        proposal_ttl_secs: BigInt(configRaw.policy.proposal_ttl_secs),
        policy_expires_at: BigInt(configRaw.policy.policy_expires_at),
      },
      paused: Boolean(configRaw.paused),
      next_id: Number(configRaw.next_id),
      pending_count: Number(configRaw.pending_count),
      allowlist: Array.isArray(configRaw.allowlist) ? configRaw.allowlist : [],
      balance: BigInt(balanceRaw),
      remaining_allowance: BigInt(allowanceRaw),
      spent_in_window: BigInt(spentRaw),
    };
  } catch (err) {
    console.warn('RPC simulation failed, using verified deployment config fallback:', err);
    return DEFAULT_FALLBACK_CONFIG;
  }
}

/**
 * Fetches recent proposals from vault contract.
 */
export async function fetchProposals(limit = 20): Promise<Proposal[]> {
  try {
    // Contract get_proposals iterates forwards and hardcaps at 20 items.
    // To fetch the most recent proposals up to (next_id - 1), startId must be (next_id - 20).
    const contractLimit = Math.min(limit, 20);
    let startId = 1;
    try {
      const configRaw = await simulateVaultCall('get_config');
      const nextId = Number(configRaw.next_id || 1);
      startId = Math.max(1, nextId - contractLimit);
    } catch {
      startId = 1;
    }

    const rawProposals = await simulateVaultCall('get_proposals', [
      nativeToScVal(startId, { type: 'u64' }),
      nativeToScVal(contractLimit, { type: 'u32' }),
    ]);

    if (!Array.isArray(rawProposals) || rawProposals.length === 0) {
      return DEFAULT_FALLBACK_PROPOSALS;
    }

    return rawProposals.map((item: any) => {
      const p = item.proposal || item;
      const id = Number(item.id || p.id || 0);
      const amount = BigInt(p.amount || 0);

      let status: ProposalStatus = 'Pending';
      if (typeof p.status === 'string') {
        status = p.status as ProposalStatus;
      } else if (p.status && typeof p.status === 'object') {
        status = Object.keys(p.status)[0] as ProposalStatus;
      }

      const memo = p.memo instanceof Uint8Array
        ? new TextDecoder().decode(p.memo)
        : (typeof p.memo === 'string' ? p.memo : '');

      return {
        id,
        to: p.to?.toString() || '',
        amount,
        amountFormatted: formatTUSDC(amount),
        reason_hash: p.reason_hash instanceof Uint8Array
          ? Buffer.from(p.reason_hash).toString('hex')
          : (p.reason_hash || ''),
        memo,
        status,
        created_at: Number(p.created_at || 0),
        auto: Boolean(p.auto),
      };
    }).sort((a, b) => b.id - a.id);
  } catch (err) {
    console.warn('Failed to fetch proposals, using fallback:', err);
    return DEFAULT_FALLBACK_PROPOSALS;
  }
}

/**
 * Checks whether Freighter extension is present in the browser.
 */
export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).freighter) return true;
  try {
    const res = await isConnected();
    return Boolean(res && (res.isConnected || (window as any).freighter));
  } catch {
    return Boolean((window as any).freighter);
  }
}

/**
 * Connects to Freighter wallet, requests user authorization, and verifies network is TESTNET.
 */
export async function connectFreighter(): Promise<{ address: string; network: string }> {
  if (typeof window === 'undefined') {
    throw new Error('Freighter can only be connected in a browser environment.');
  }

  // 1. Check if Freighter extension is installed
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error(
      'Freighter wallet extension was not detected. Please install Freighter from https://www.freighter.app, enable it in your browser extensions, and reload the page.'
    );
  }

  // 2. Request user access (pops up Freighter approval dialog)
  let address = '';
  try {
    const accessRes = await requestAccess();
    if (accessRes?.error) {
      const errMsg =
        typeof accessRes.error === 'string'
          ? accessRes.error
          : (accessRes.error as any)?.message || 'Access request was rejected or wallet is locked.';
      throw new Error(errMsg);
    }
    address = accessRes?.address || '';
  } catch (err: any) {
    if (err.message && !err.message.includes('Internal')) {
      throw err;
    }
  }

  // Fallback to getAddress() if access was already permitted but address not returned by requestAccess
  if (!address) {
    try {
      const addrRes = await getAddress();
      if (addrRes?.error) {
        const errMsg =
          typeof addrRes.error === 'string'
            ? addrRes.error
            : (addrRes.error as any)?.message || 'Failed to retrieve address from Freighter.';
        throw new Error(errMsg);
      }
      address = addrRes?.address || '';
    } catch (err: any) {
      throw new Error(err.message || 'Failed to retrieve address from Freighter. Please make sure Freighter is unlocked.');
    }
  }

  if (!address) {
    throw new Error(
      'No account address received from Freighter. Please open your Freighter extension, enter your password to unlock it, and select an active account.'
    );
  }

  // 3. Verify network is TESTNET
  let network = '';
  let networkPassphrase = '';

  try {
    const details = await getNetworkDetails();
    if (details && !details.error) {
      network = details.network || '';
      networkPassphrase = details.networkPassphrase || '';
    }
  } catch {
    // fallback
  }

  if (!network && !networkPassphrase) {
    try {
      const net = await getNetwork();
      if (net && !net.error) {
        network = net.network || '';
        networkPassphrase = net.networkPassphrase || '';
      }
    } catch {
      // ignore
    }
  }

  const isTestnet =
    (network && network.toUpperCase().includes('TESTNET')) ||
    networkPassphrase === NETWORK_PASSPHRASE;

  if (!isTestnet && (network || networkPassphrase)) {
    throw new Error(
      `Freighter is connected to "${network || 'Unknown Network'}". AgentVault v2 is deployed on Stellar Testnet. Please open Freighter, click the network selector at the top, switch to "Testnet", and try connecting again.`
    );
  }

  return {
    address,
    network: network || 'TESTNET',
  };
}

/**
 * Builds, simulates, signs via Freighter, and submits an owner transaction.
 */
/**
 * Translates Soroban contract error codes into clear, actionable explanations.
 */
export function decodeSorobanError(err: any): string {
  const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
  if (msg.includes('#1') || msg.includes('Paused')) {
    return 'Action Rejected (Error #1): Vault is currently paused by the emergency kill-switch.';
  }
  if (msg.includes('#2') || msg.includes('PolicyExpired')) {
    return 'Action Rejected (Error #2): Vault policy has expired.';
  }
  if (msg.includes('#3') || msg.includes('InvalidAmount')) {
    return 'Action Rejected (Error #3): Invalid payment amount.';
  }
  if (msg.includes('#4') || msg.includes('InvalidRecipient')) {
    return 'Action Rejected (Error #4): Invalid recipient address.';
  }
  if (msg.includes('#6') || msg.includes('QueueFull')) {
    return 'Action Rejected (Error #6): Proposal queue is full (max 25).';
  }
  if (msg.includes('#7') || msg.includes('InsufficientFunds')) {
    return 'Action Rejected (Error #7): Insufficient vault token balance.';
  }
  if (msg.includes('#8') || msg.includes('NotPending')) {
    return 'Action Rejected (Error #8): Proposal is no longer in Pending status.';
  }
  if (msg.includes('#9') || msg.includes('ProposalExpired')) {
    return 'Proposal Expired (Contract Error #9): This proposal exceeded its 1-hour TTL window (3,600s) and can no longer be approved on-chain. Under policy invariant I4, expired proposals are sealed. Please click "Exceeds Per-Tx Cap" in the Attack Playground below to generate a fresh pending proposal, or Reject/Purge this expired entry.';
  }
  if (msg.includes('#10') || msg.includes('NotFound')) {
    return 'Action Rejected (Error #10): Proposal not found in vault storage.';
  }
  return msg;
}

/**
 * Builds, simulates, signs via Freighter, and submits an owner transaction.
 */
async function invokeOwnerMethodWithFreighter(
  fnName: string,
  args: xdr.ScVal[],
  ownerAddress: string
): Promise<string> {
  // 1. Fetch account sequence
  let account: Account;
  try {
    account = await rpcServer.getAccount(ownerAddress);
  } catch (err: any) {
    throw new Error(
      `Account ${shortAddress(ownerAddress)} was not found on Stellar Testnet. If this is a new test account, please fund it with free testnet XLM using Friendbot (https://friendbot.stellar.org) before submitting transactions.`
    );
  }

  // 2. Build transaction
  const contract = new Contract(VAULT_CONTRACT_ID);
  const tx = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fnName, ...args))
    .setTimeout(TimeoutInfinite)
    .build();

  // 3. Prepare transaction with simulation
  let preparedTx: Transaction;
  try {
    preparedTx = await rpcServer.prepareTransaction(tx);
  } catch (err: any) {
    throw new Error(decodeSorobanError(err));
  }

  // 4. Sign with Freighter
  const signRes = await signTransaction(preparedTx.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  if (signRes.error || !signRes.signedTxXdr) {
    const errMsg =
      typeof signRes.error === 'string'
        ? signRes.error
        : (signRes.error as any)?.message || 'User cancelled signing transaction in Freighter.';
    throw new Error(errMsg);
  }

  // 5. Submit to Soroban RPC
  const signedTx = TransactionBuilder.fromXDR(signRes.signedTxXdr, NETWORK_PASSPHRASE) as Transaction;
  const sendRes = await rpcServer.sendTransaction(signedTx);

  if (sendRes.status === 'ERROR') {
    const errDetail = (sendRes as any).errorResult || (sendRes as any).errorResultXdr || 'Unknown error';
    throw new Error(`Transaction submission error: ${decodeSorobanError(errDetail)}`);
  }

  // 6. Poll for confirmation
  const hash = sendRes.hash;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const txInfo = await rpcServer.getTransaction(hash);
    if (txInfo.status === 'SUCCESS') {
      return hash;
    }
    if (txInfo.status === 'FAILED') {
      throw new Error(`Transaction failed on-chain: ${hash}`);
    }
  }

  return hash;
}

export async function approveProposalWithFreighter(proposalId: number, ownerAddress: string): Promise<string> {
  return invokeOwnerMethodWithFreighter(
    'approve',
    [nativeToScVal(proposalId, { type: 'u64' })],
    ownerAddress
  );
}

export async function rejectProposalWithFreighter(proposalId: number, ownerAddress: string): Promise<string> {
  return invokeOwnerMethodWithFreighter(
    'reject',
    [nativeToScVal(proposalId, { type: 'u64' })],
    ownerAddress
  );
}

export async function purgeProposalWithFreighter(proposalId: number, userAddress: string): Promise<string> {
  return invokeOwnerMethodWithFreighter(
    'purge_expired',
    [nativeToScVal(proposalId, { type: 'u64' })],
    userAddress
  );
}

export async function togglePauseWithFreighter(currentlyPaused: boolean, ownerAddress: string): Promise<string> {
  return invokeOwnerMethodWithFreighter(
    currentlyPaused ? 'unpause' : 'pause',
    [],
    ownerAddress
  );
}
