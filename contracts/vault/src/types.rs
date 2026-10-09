use soroban_sdk::{contracterror, contracttype, Address, BytesN, String, Vec};

pub const MAX_PENDING: u32 = 25;
pub const MAX_ALLOWLIST: u32 = 32;
pub const MIN_TTL_SECS: u64 = 60;
pub const MAX_TTL_SECS: u64 = 604_800; // 7 days

// Instance & Persistent TTL constants (in ledgers; ~5s per ledger)
// Threshold: ~1 day (17,280 ledgers), Extend to: ~7 days (120,960 ledgers)
pub const INSTANCE_TTL_THRESHOLD: u32 = 17_280;
pub const INSTANCE_TTL_EXTEND: u32 = 120_960;
pub const PERSISTENT_TTL_THRESHOLD: u32 = 17_280;
pub const PERSISTENT_TTL_EXTEND: u32 = 120_960;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Policy {
    pub per_tx_cap: i128,       // > 0
    pub daily_cap: i128,        // >= per_tx_cap; applies to rolling 23h span
    pub proposal_ttl_secs: u64, // 60 ..= 604_800
    pub policy_expires_at: u64, // 0 = never; else unix seconds
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Status {
    Pending = 0,
    Executed = 1,
    Rejected = 2,
    Expired = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub to: Address,
    pub amount: i128,
    pub reason_hash: BytesN<32>, // sha256 of off-chain rationale/invoice
    pub memo: String,            // <= 64 bytes, display only
    pub created_at: u64,
    pub status: Status,
    pub auto: bool, // true if executed without human
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultConfig {
    pub owner: Address,
    pub agent: Address,
    pub token: Address,
    pub policy: Policy,
    pub paused: bool,
    pub next_id: u64,
    pub pending_count: u32,
    pub allowlist: Vec<Address>,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    Paused = 1,
    PolicyExpired = 2,
    InvalidAmount = 3,
    InvalidRecipient = 4,
    MemoTooLong = 5,
    QueueFull = 6,
    InsufficientFunds = 7,
    NotPending = 8,
    ProposalExpired = 9,
    NotFound = 10,
    InvalidPolicy = 11,
    AllowlistTooLarge = 12,
    Overflow = 13,
    NotExpired = 14,
    AlreadyInitialized = 15,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage keys
    Owner,
    Agent,
    Token,
    Policy,
    Paused,
    NextId,
    PendingCount,
    Allowlist,

    // Persistent storage keys
    Proposal(u64),
    Bucket(u64), // hour index -> amount
}
