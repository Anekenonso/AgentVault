export interface Policy {
  per_tx_cap: bigint;
  daily_cap: bigint;
  proposal_ttl_secs: bigint;
  policy_expires_at: bigint;
}

export type ProposalStatus = 'Pending' | 'Executed' | 'Rejected' | 'Expired';

export interface Proposal {
  id: number;
  to: string;
  amount: bigint;
  amountFormatted: string;
  reason_hash: string;
  memo: string;
  status: ProposalStatus;
  created_at: number;
  auto: boolean;
}

export interface VaultConfig {
  owner: string;
  agent: string;
  token: string;
  policy: Policy;
  paused: boolean;
  next_id: number;
  pending_count: number;
  allowlist: string[];
  balance: bigint;
  remaining_allowance: bigint;
  spent_in_window: bigint;
}

export interface SummaryEvidence {
  network: string;
  timestamp: string;
  e1_containment_attempts: number;
  e1_containment_blocked: number;
  e1_attacker_loss: string;
  e2_corpus_size: number;
  e2_containment_rate: string;
  e3_naive_vault_drained: string;
  e3_drain_tx_hash: string;
  e3_drain_explorer: string;
}
