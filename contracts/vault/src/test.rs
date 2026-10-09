#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, BytesN, Env, IntoVal, String, Vec};
use types::{Error, Policy, Status, MAX_ALLOWLIST, MAX_PENDING};

fn create_test_env() -> (
    Env,
    Address, // owner
    Address, // agent
    Address, // provider (allowlisted)
    Address, // recipient2 (not allowlisted)
    Address, // token
    Address, // vault
) {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let provider = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address();

    let policy = Policy {
        per_tx_cap: 5_0000000,   // 5 tokens
        daily_cap: 20_0000000,   // 20 tokens
        proposal_ttl_secs: 3600, // 1 hour
        policy_expires_at: 0,    // never
    };

    let vault = env.register(VaultContract, (&owner, &agent, &token, &policy));

    // Set allowlist to include provider
    let client = VaultContractClient::new(&env, &vault);
    let mut allowlist = Vec::new(&env);
    allowlist.push_back(provider.clone());
    client.set_allowlist(&allowlist);

    // Mint 100 tokens to vault
    let token_admin_client = token::StellarAssetClient::new(&env, &token);
    token_admin_client.mint(&vault, &100_0000000);

    (env, owner, agent, provider, recipient2, token, vault)
}

fn dummy_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

// ----------------------------------------------------------------------------
// 1. CONSTRUCTOR VALIDATION TESTS
// ----------------------------------------------------------------------------
#[test]
fn test_constructor_validation() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let token = Address::generate(&env);

    // Bad: per_tx_cap <= 0
    let bad_policy1 = Policy {
        per_tx_cap: 0,
        daily_cap: 20_0000000,
        proposal_ttl_secs: 3600,
        policy_expires_at: 0,
    };
    assert_eq!(
        VaultContract::__constructor(
            env.clone(),
            owner.clone(),
            agent.clone(),
            token.clone(),
            bad_policy1
        ),
        Err(Error::InvalidPolicy)
    );

    // Bad: daily_cap < per_tx_cap
    let bad_policy2 = Policy {
        per_tx_cap: 10_0000000,
        daily_cap: 5_0000000,
        proposal_ttl_secs: 3600,
        policy_expires_at: 0,
    };
    assert_eq!(
        VaultContract::__constructor(
            env.clone(),
            owner.clone(),
            agent.clone(),
            token.clone(),
            bad_policy2
        ),
        Err(Error::InvalidPolicy)
    );

    // Bad: ttl < 60
    let bad_policy3 = Policy {
        per_tx_cap: 5_0000000,
        daily_cap: 20_0000000,
        proposal_ttl_secs: 30,
        policy_expires_at: 0,
    };
    assert_eq!(
        VaultContract::__constructor(env.clone(), owner, agent, token, bad_policy3),
        Err(Error::InvalidPolicy)
    );
}

// ----------------------------------------------------------------------------
// 2. PROPOSE: ALLOWLISTED + WITHIN CAPS -> AUTO-EXECUTED
// ----------------------------------------------------------------------------
#[test]
fn test_propose_auto_executed_happy_path() {
    let (env, _owner, _agent, provider, _rec2, token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let token_client = token::Client::new(&env, &token);

    let amount = 3_0000000i128; // 3 tokens (<= per_tx_cap 5)
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "api-pay");

    let initial_vault_bal = token_client.balance(&vault);
    let initial_provider_bal = token_client.balance(&provider);

    let (id, status) = client.propose(&provider, &amount, &hash, &memo);

    assert_eq!(id, 1);
    assert_eq!(status, Status::Executed);

    // Assert balances changed
    assert_eq!(token_client.balance(&vault), initial_vault_bal - amount);
    assert_eq!(
        token_client.balance(&provider),
        initial_provider_bal + amount
    );

    // Assert proposal record
    let prop = client.get_proposal(&id).unwrap();
    assert_eq!(prop.status, Status::Executed);
    assert!(prop.auto);
    assert_eq!(prop.amount, amount);

    // Assert remaining allowance updated
    assert_eq!(client.remaining_allowance(), 20_0000000 - amount);
    assert_eq!(client.spent_in_window(), amount);
}

// ----------------------------------------------------------------------------
// 3. PROPOSE: UNKNOWN RECIPIENT -> PENDING QUEUE
// ----------------------------------------------------------------------------
#[test]
fn test_propose_unknown_recipient_enqueues_pending() {
    let (env, _owner, _agent, _provider, recipient2, token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let token_client = token::Client::new(&env, &token);

    let amount = 3_0000000i128;
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "unknown-recipient");

    let initial_vault_bal = token_client.balance(&vault);

    let (id, status) = client.propose(&recipient2, &amount, &hash, &memo);

    assert_eq!(id, 1);
    assert_eq!(status, Status::Pending);

    // Vault funds must NOT move
    assert_eq!(token_client.balance(&vault), initial_vault_bal);
    assert_eq!(token_client.balance(&recipient2), 0);

    let config = client.get_config();
    assert_eq!(config.pending_count, 1);

    let prop = client.get_proposal(&id).unwrap();
    assert_eq!(prop.status, Status::Pending);
    assert!(!prop.auto);
}

// ----------------------------------------------------------------------------
// 4. PROPOSE: OVER PER-TX CAP -> PENDING QUEUE
// ----------------------------------------------------------------------------
#[test]
fn test_propose_over_per_tx_cap_enqueues_pending() {
    let (env, _owner, _agent, provider, _rec2, token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let token_client = token::Client::new(&env, &token);

    let amount = 8_0000000i128; // > per_tx_cap 5
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "over-cap");

    let initial_vault_bal = token_client.balance(&vault);

    let (_id, status) = client.propose(&provider, &amount, &hash, &memo);
    assert_eq!(status, Status::Pending);
    assert_eq!(token_client.balance(&vault), initial_vault_bal);
}

// ----------------------------------------------------------------------------
// 5. PROPOSE: WOULD EXCEED DAILY CAP -> PENDING QUEUE
// ----------------------------------------------------------------------------
#[test]
fn test_propose_exceed_daily_cap_enqueues_pending() {
    let (env, _owner, _agent, provider, _rec2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "daily-burst");

    // Spend 4 * 5 = 20 tokens (reaches daily cap)
    for _ in 0..4 {
        let (_id, status) = client.propose(&provider, &5_0000000, &hash, &memo);
        assert_eq!(status, Status::Executed);
    }

    assert_eq!(client.spent_in_window(), 20_0000000);
    assert_eq!(client.remaining_allowance(), 0);

    // 5th payment would exceed daily cap -> must be enqueued as Pending!
    let (id, status) = client.propose(&provider, &1_0000000, &hash, &memo);
    assert_eq!(status, Status::Pending);
    assert_eq!(id, 5);
}

// ----------------------------------------------------------------------------
// 6. PROPOSE INPUT REJECTIONS
// ----------------------------------------------------------------------------
#[test]
fn test_propose_input_rejections() {
    let (env, _owner, _agent, provider, _rec2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "test");

    // Zero / negative amount
    assert_eq!(
        client.try_propose(&provider, &0, &hash, &memo),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        client.try_propose(&provider, &-100, &hash, &memo),
        Err(Ok(Error::InvalidAmount))
    );

    // Self-recipient
    assert_eq!(
        client.try_propose(&vault, &1_0000000, &hash, &memo),
        Err(Ok(Error::InvalidRecipient))
    );

    // Memo > 64 bytes
    let long_memo = String::from_str(
        &env,
        "12345678901234567890123456789012345678901234567890123456789012345", // 65 bytes
    );
    assert_eq!(
        client.try_propose(&provider, &1_0000000, &hash, &long_memo),
        Err(Ok(Error::MemoTooLong))
    );
}

// ----------------------------------------------------------------------------
// 7. PROPOSE WHILE PAUSED & EXPIRED POLICY
// ----------------------------------------------------------------------------
#[test]
fn test_propose_paused_and_expired_policy() {
    let (env, _owner, _agent, provider, _rec2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "test");

    // Pause
    client.pause();
    assert_eq!(
        client.try_propose(&provider, &1_0000000, &hash, &memo),
        Err(Ok(Error::Paused))
    );
    client.unpause();

    // Expire policy
    let expired_policy = Policy {
        per_tx_cap: 5_0000000,
        daily_cap: 20_0000000,
        proposal_ttl_secs: 3600,
        policy_expires_at: 100, // expired relative to timestamp > 100
    };
    env.ledger().set_timestamp(200);
    client.set_policy(&expired_policy);

    assert_eq!(
        client.try_propose(&provider, &1_0000000, &hash, &memo),
        Err(Ok(Error::PolicyExpired))
    );
}

// ----------------------------------------------------------------------------
// 8. QUEUE AT MAX (25) -> QUEUE FULL
// ----------------------------------------------------------------------------
#[test]
fn test_queue_full_rejection() {
    let (env, _owner, _agent, _provider, recipient2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "pending-spam");

    // Fill queue to MAX_PENDING (25)
    for _ in 0..MAX_PENDING {
        let (_id, status) = client.propose(&recipient2, &1_0000000, &hash, &memo);
        assert_eq!(status, Status::Pending);
    }
    assert_eq!(client.get_config().pending_count, MAX_PENDING);

    // 26th proposal must revert with QueueFull
    assert_eq!(
        client.try_propose(&recipient2, &1_0000000, &hash, &memo),
        Err(Ok(Error::QueueFull))
    );
}

// ----------------------------------------------------------------------------
// 9. INSUFFICIENT FUNDS -> NO STATE CHANGE
// ----------------------------------------------------------------------------
#[test]
fn test_insufficient_funds_reverts_with_no_state_change() {
    let (env, _owner, _agent, provider, _rec2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "empty-vault");

    // Withdraw all funds first
    let config = client.get_config();
    client.withdraw(&config.owner, &100_0000000);
    assert_eq!(client.balance(), 0);

    let next_id_before = client.get_config().next_id;
    let pending_before = client.get_config().pending_count;

    // Propose an allowlisted transaction
    assert_eq!(
        client.try_propose(&provider, &2_0000000, &hash, &memo),
        Err(Ok(Error::InsufficientFunds))
    );

    // Invariant: NextId and PendingCount must NOT have changed!
    assert_eq!(client.get_config().next_id, next_id_before);
    assert_eq!(client.get_config().pending_count, pending_before);
    assert_eq!(client.spent_in_window(), 0);
}

// ----------------------------------------------------------------------------
// 10. ROLLING WINDOW BUCKET FALL-OFF & BOUNDARY BURST
// ----------------------------------------------------------------------------
#[test]
fn test_rolling_window_bucket_fall_off() {
    let (env, _owner, _agent, provider, _rec2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "hourly");

    // Spend 5 tokens at hour 0 (timestamp 100)
    env.ledger().set_timestamp(100);
    client.propose(&provider, &5_0000000, &hash, &memo);
    assert_eq!(client.spent_in_window(), 5_0000000);

    // Advance to hour 23 (timestamp 23 * 3600 + 100)
    env.ledger().set_timestamp(23 * 3600 + 100);
    // Hour 0 is still in rolling 23h window
    assert_eq!(client.spent_in_window(), 5_0000000);

    // Spend another 5 tokens at hour 23
    client.propose(&provider, &5_0000000, &hash, &memo);
    assert_eq!(client.spent_in_window(), 10_0000000);

    // Advance to hour 24 (timestamp 24 * 3600 + 100)
    env.ledger().set_timestamp(24 * 3600 + 100);
    // Hour 0 MUST fall out of the 23-hour window!
    // Spent in window should now be only the 5 tokens from hour 23!
    assert_eq!(client.spent_in_window(), 5_0000000);
    assert_eq!(client.remaining_allowance(), 15_0000000);
}

// ----------------------------------------------------------------------------
// 11. APPROVE, REJECT, PURGE EXPIRED FLOWS
// ----------------------------------------------------------------------------
#[test]
fn test_approve_reject_purge_flows() {
    let (env, _owner, _agent, _provider, recipient2, token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);
    let token_client = token::Client::new(&env, &token);
    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "pending-tx");

    env.ledger().set_timestamp(1000);

    // Proposal 1: Over cap -> Pending
    let (id1, _) = client.propose(&recipient2, &10_0000000, &hash, &memo);

    // Owner approves Proposal 1
    client.approve(&id1);
    assert_eq!(client.get_proposal(&id1).unwrap().status, Status::Executed);
    assert_eq!(token_client.balance(&recipient2), 10_0000000);
    assert_eq!(client.get_config().pending_count, 0);

    // Double approve must fail
    assert_eq!(client.try_approve(&id1), Err(Ok(Error::NotPending)));

    // Proposal 2: Owner rejects
    let (id2, _) = client.propose(&recipient2, &10_0000000, &hash, &memo);
    client.reject(&id2);
    assert_eq!(client.get_proposal(&id2).unwrap().status, Status::Rejected);
    assert_eq!(client.get_config().pending_count, 0);

    // Proposal 3: Expires and purged
    let (id3, _) = client.propose(&recipient2, &10_0000000, &hash, &memo);
    // Proposal TTL is 3600. Advance timestamp to 1000 + 3601
    env.ledger().set_timestamp(1000 + 3601);

    // Approve should fail because proposal expired
    assert_eq!(client.try_approve(&id3), Err(Ok(Error::ProposalExpired)));

    // Purge expired succeeds
    client.purge_expired(&id3);
    assert_eq!(client.get_proposal(&id3).unwrap().status, Status::Expired);
    assert_eq!(client.get_config().pending_count, 0);
}

// ----------------------------------------------------------------------------
// 12. OWNER ADMIN FUNCTIONS & ALLOWLIST BOUNDS
// ----------------------------------------------------------------------------
#[test]
fn test_owner_admin_functions_and_bounds() {
    let (env, _owner, _agent, _provider, _rec2, _token, vault) = create_test_env();
    let client = VaultContractClient::new(&env, &vault);

    // Rotate agent
    let new_agent = Address::generate(&env);
    client.set_agent(&new_agent);
    assert_eq!(client.get_config().agent, new_agent);

    // Allowlist > 32 must revert
    let mut big_list = Vec::new(&env);
    for _ in 0..33 {
        big_list.push_back(Address::generate(&env));
    }
    assert_eq!(
        client.try_set_allowlist(&big_list),
        Err(Ok(Error::AllowlistTooLarge))
    );

    // Allowlist <= 32 succeeds
    let mut ok_list = Vec::new(&env);
    for _ in 0..MAX_ALLOWLIST {
        ok_list.push_back(Address::generate(&env));
    }
    client.set_allowlist(&ok_list);
    assert_eq!(client.get_config().allowlist.len(), MAX_ALLOWLIST);
}

// ----------------------------------------------------------------------------
// 13. PRECISE AUTHORIZATION TESTS (MockAuth)
// ----------------------------------------------------------------------------
#[test]
fn test_strict_auth_isolation() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let agent = Address::generate(&env);
    let attacker = Address::generate(&env);
    let provider = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let policy = Policy {
        per_tx_cap: 5_0000000,
        daily_cap: 20_0000000,
        proposal_ttl_secs: 3600,
        policy_expires_at: 0,
    };

    let vault = env.register(VaultContract, (&owner, &agent, &token, &policy));
    let client = VaultContractClient::new(&env, &vault);

    let hash = dummy_hash(&env);
    let memo = String::from_str(&env, "auth-test");

    // Agent can invoke propose
    client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &agent,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &vault,
                fn_name: "propose",
                args: (&provider, 1_0000000i128, &hash, &memo).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .propose(&provider, &1_0000000, &hash, &memo);

    // Attacker cannot invoke propose
    let attacker_propose = client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &attacker,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &vault,
                fn_name: "propose",
                args: (&provider, 1_0000000i128, &hash, &memo).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_propose(&provider, &1_0000000, &hash, &memo);
    assert!(attacker_propose.is_err());

    // Agent cannot call pause (owner only)
    let agent_pause = client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &agent,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &vault,
                fn_name: "pause",
                args: ().into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_pause();
    assert!(agent_pause.is_err());

    // Attacker cannot call withdraw
    let attacker_withdraw = client
        .mock_auths(&[soroban_sdk::testutils::MockAuth {
            address: &attacker,
            invoke: &soroban_sdk::testutils::MockAuthInvoke {
                contract: &vault,
                fn_name: "withdraw",
                args: (&attacker, 10_0000000i128).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .try_withdraw(&attacker, &10_0000000);
    assert!(attacker_withdraw.is_err());
}
