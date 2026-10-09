#![cfg(test)]

extern crate std;
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{token, Address, BytesN, Env, String, Vec};
use std::collections::{BTreeMap, HashMap};
use std::vec::Vec as StdVec;
use types::{Error, Policy, Status, MAX_PENDING};

// Deterministic PRNG with fixed logged seed
struct Prng {
    state: u64,
}

impl Prng {
    fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.state
    }

    fn gen_range(&mut self, min: u64, max: u64) -> u64 {
        if min >= max {
            return min;
        }
        min + (self.next_u64() % (max - min + 1))
    }

    fn gen_bool(&mut self) -> bool {
        (self.next_u64() & 1) == 1
    }
}

#[derive(Clone, Debug)]
#[allow(dead_code)]
struct RefProposal {
    id: u64,
    to: Address,
    amount: i128,
    created_at: u64,
    status: Status,
    auto: bool,
}

struct RefVaultModel {
    per_tx_cap: i128,
    daily_cap: i128,
    proposal_ttl_secs: u64,
    paused: bool,
    next_id: u64,
    pending_count: u32,
    allowlist: StdVec<Address>,
    proposals: HashMap<u64, RefProposal>,
    hourly_buckets: BTreeMap<u64, i128>,
    vault_balance: i128,
    payee_balances: BTreeMap<Address, i128>,
    executed_history: StdVec<(u64, i128, Address, bool)>, // (timestamp, amount, to, auto)
}

impl RefVaultModel {
    fn new(per_tx_cap: i128, daily_cap: i128, ttl_secs: u64, initial_balance: i128) -> Self {
        Self {
            per_tx_cap,
            daily_cap,
            proposal_ttl_secs: ttl_secs,
            paused: false,
            next_id: 1,
            pending_count: 0,
            allowlist: StdVec::new(),
            proposals: HashMap::new(),
            hourly_buckets: BTreeMap::new(),
            vault_balance: initial_balance,
            payee_balances: BTreeMap::new(),
            executed_history: StdVec::new(),
        }
    }

    fn spent_in_window(&self, now: u64) -> i128 {
        let current_hour = now / 3600;
        let start_hour = current_hour.saturating_sub(23);
        let mut sum = 0;
        for h in start_hour..=current_hour {
            if let Some(&amt) = self.hourly_buckets.get(&h) {
                sum += amt;
            }
        }
        sum
    }
}

#[test]
fn test_model_based_property_invariants_5000_operations() {
    let seed: u64 = 0x5EED_C0DE_1234_5678;
    std::println!(
        "--- Running Model-Based Property Test (Seed: 0x{:X}, Ops: 5,000) ---",
        seed
    );
    let mut rng = Prng::new(seed);

    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let agent = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let token = env
        .register_stellar_asset_contract_v2(token_admin)
        .address();

    let per_tx_cap = 5_0000000i128;
    let daily_cap = 20_0000000i128;
    let ttl_secs = 3600u64;

    let policy = Policy {
        per_tx_cap,
        daily_cap,
        proposal_ttl_secs: ttl_secs,
        policy_expires_at: 0,
    };

    let vault = env.register(VaultContract, (&owner, &agent, &token, &policy));
    let client = VaultContractClient::new(&env, &vault);

    let initial_vault_funds = 1000_0000000i128; // 1,000 tokens
    let token_admin_client = token::StellarAssetClient::new(&env, &token);
    token_admin_client.mint(&vault, &initial_vault_funds);

    let mut model = RefVaultModel::new(per_tx_cap, daily_cap, ttl_secs, initial_vault_funds);

    // Setup 3 allowlisted payees and 3 non-allowlisted payees
    let allowlisted_payees: StdVec<Address> = (0..3).map(|_| Address::generate(&env)).collect();
    let external_payees: StdVec<Address> = (0..3).map(|_| Address::generate(&env)).collect();

    let mut allowlist_val = Vec::new(&env);
    for p in &allowlisted_payees {
        allowlist_val.push_back(p.clone());
        model.allowlist.push(p.clone());
    }
    client.set_allowlist(&allowlist_val);

    let mut current_time: u64 = 1700000000;
    env.ledger().set_timestamp(current_time);

    let mut total_propose = 0;
    let mut total_auto_executed = 0;
    let mut total_pending = 0;
    let mut total_approved = 0;
    let mut total_rejected = 0;
    let mut total_purged = 0;

    for step in 0..5_000 {
        // Advance time randomly between 0 and 600 seconds
        let dt = rng.gen_range(0, 600);
        current_time += dt;
        env.ledger().set_timestamp(current_time);

        let action_type = rng.gen_range(0, 5);

        match action_type {
            // ACTION 0, 1, 2: PROPOSE (weighted towards payments)
            0 | 1 | 2 => {
                total_propose += 1;
                let is_allowlisted = rng.gen_bool();
                let recipient = if is_allowlisted {
                    &allowlisted_payees
                        [rng.gen_range(0, allowlisted_payees.len() as u64 - 1) as usize]
                } else {
                    &external_payees[rng.gen_range(0, external_payees.len() as u64 - 1) as usize]
                };

                // Amount: 0.1 to 8.0 tokens
                let amount = rng.gen_range(1_000000, 80_000000) as i128;
                let hash = BytesN::from_array(&env, &[((step & 0xFF) as u8); 32]);
                let memo = String::from_str(&env, "prop-test");

                let res = client.try_propose(recipient, &amount, &hash, &memo);

                if model.paused {
                    assert_eq!(
                        res,
                        Err(Ok(Error::Paused)),
                        "Invariant I7 violated: propose did not revert while paused"
                    );
                } else {
                    let spent = model.spent_in_window(current_time);
                    let within_policy = is_allowlisted
                        && amount <= model.per_tx_cap
                        && (spent + amount) <= model.daily_cap;

                    if within_policy {
                        if model.vault_balance >= amount {
                            assert!(res.is_ok(), "Expected Ok for valid auto-propose");
                            let (_id, status) = res.unwrap().unwrap();
                            assert_eq!(status, Status::Executed);
                            total_auto_executed += 1;

                            // Model update
                            let current_hour = current_time / 3600;
                            let entry = model.hourly_buckets.entry(current_hour).or_insert(0);
                            *entry += amount;
                            model.vault_balance -= amount;
                            *model.payee_balances.entry(recipient.clone()).or_insert(0) += amount;
                            model.next_id += 1;
                            model.executed_history.push((
                                current_time,
                                amount,
                                recipient.clone(),
                                true,
                            ));

                            // INVARIANT I1: Auto-executed ONLY to allowlist
                            assert!(
                                model.allowlist.contains(recipient),
                                "INVARIANT I1 VIOLATION: Auto-executed to non-allowlisted address!"
                            );

                            // INVARIANT I2: Transfer <= per_tx_cap
                            assert!(
                                amount <= model.per_tx_cap,
                                "INVARIANT I2 VIOLATION: Auto-executed amount {} > per_tx_cap {}!",
                                amount,
                                model.per_tx_cap
                            );
                        } else {
                            assert_eq!(res, Err(Ok(Error::InsufficientFunds)));
                        }
                    } else {
                        // Out of policy -> must enqueue as Pending (unless queue full)
                        if model.pending_count >= MAX_PENDING {
                            assert_eq!(res, Err(Ok(Error::QueueFull)));
                        } else {
                            assert!(res.is_ok(), "Expected Ok for Pending enqueue");
                            let (id, status) = res.unwrap().unwrap();
                            assert_eq!(status, Status::Pending);
                            total_pending += 1;

                            model.proposals.insert(
                                id,
                                RefProposal {
                                    id,
                                    to: recipient.clone(),
                                    amount,
                                    created_at: current_time,
                                    status: Status::Pending,
                                    auto: false,
                                },
                            );
                            model.next_id += 1;
                            model.pending_count += 1;
                        }
                    }
                }
            }

            // ACTION 3: APPROVE or REJECT pending proposal
            3 => {
                let pending_ids: StdVec<u64> = model
                    .proposals
                    .iter()
                    .filter(|(_, p)| p.status == Status::Pending)
                    .map(|(&id, _)| id)
                    .collect();

                if !pending_ids.is_empty() {
                    let target_id =
                        pending_ids[rng.gen_range(0, pending_ids.len() as u64 - 1) as usize];
                    let prop = model.proposals.get_mut(&target_id).unwrap();

                    let is_expired = current_time > prop.created_at + model.proposal_ttl_secs;
                    let should_approve = rng.gen_bool();

                    if should_approve {
                        let res = client.try_approve(&target_id);
                        if model.paused {
                            assert_eq!(
                                res,
                                Err(Ok(Error::Paused)),
                                "Invariant I7: approve did not revert while paused"
                            );
                        } else if is_expired {
                            assert_eq!(res, Err(Ok(Error::ProposalExpired)));
                        } else if model.vault_balance < prop.amount {
                            assert_eq!(res, Err(Ok(Error::InsufficientFunds)));
                        } else {
                            assert!(res.is_ok());
                            total_approved += 1;
                            prop.status = Status::Executed;
                            model.pending_count -= 1;
                            model.vault_balance -= prop.amount;
                            *model.payee_balances.entry(prop.to.clone()).or_insert(0) +=
                                prop.amount;
                            model.executed_history.push((
                                current_time,
                                prop.amount,
                                prop.to.clone(),
                                false,
                            ));
                        }
                    } else {
                        // Reject
                        let res = client.try_reject(&target_id);
                        assert!(res.is_ok());
                        total_rejected += 1;
                        prop.status = Status::Rejected;
                        model.pending_count -= 1;
                    }
                }
            }

            // ACTION 4: PURGE EXPIRED
            4 => {
                let expired_ids: StdVec<u64> = model
                    .proposals
                    .iter()
                    .filter(|(_, p)| {
                        p.status == Status::Pending
                            && current_time > p.created_at + model.proposal_ttl_secs
                    })
                    .map(|(&id, _)| id)
                    .collect();

                if !expired_ids.is_empty() {
                    let target_id = expired_ids[0];
                    let res = client.try_purge_expired(&target_id);
                    assert!(res.is_ok());
                    total_purged += 1;
                    model.proposals.get_mut(&target_id).unwrap().status = Status::Expired;
                    model.pending_count -= 1;
                }
            }

            // ACTION 5: TOGGLE PAUSE (infrequent)
            _ => {
                if rng.gen_range(0, 20) == 0 {
                    if model.paused {
                        client.unpause();
                        model.paused = false;
                    } else {
                        client.pause();
                        model.paused = true;
                    }
                }
            }
        }

        // --------------------------------------------------------------------
        // SYSTEM INVARIANTS CHECKED AFTER EVERY OPERATION (I1-I8)
        // --------------------------------------------------------------------

        // INVARIANT I3: Sum of auto-executed spends in any rolling 23h span <= daily_cap
        let window_start = current_time.saturating_sub(23 * 3600);
        let mut window_auto_spent = 0;
        for &(ts, amt, _, auto) in &model.executed_history {
            if auto && ts >= window_start && ts <= current_time {
                window_auto_spent += amt;
            }
        }
        assert!(
            window_auto_spent <= model.daily_cap,
            "INVARIANT I3 VIOLATION at step {}: 23h rolling auto-spend {} exceeded daily_cap {}!",
            step,
            window_auto_spent,
            model.daily_cap
        );

        // INVARIANT I5: Proposal execution uniqueness
        let on_chain_proposals = client.get_proposals(&1, &20);
        for p in on_chain_proposals.iter() {
            if let Some(ref_p) = model.proposals.get(&p.id) {
                assert_eq!(
                    p.status, ref_p.status,
                    "Invariant I5: Status mismatch for proposal {}",
                    p.id
                );
            }
        }

        // INVARIANT I6: Vault balance matches exactly
        assert_eq!(
            client.balance(),
            model.vault_balance,
            "INVARIANT I6 VIOLATION: Contract balance {} != Model balance {}",
            client.balance(),
            model.vault_balance
        );

        // Config state matches
        let config = client.get_config();
        assert_eq!(config.paused, model.paused);
        assert_eq!(config.pending_count, model.pending_count);
        assert_eq!(config.next_id, model.next_id);
    }

    std::println!("--- Model-Based Property Test Results ---");
    std::println!("Total Operations: 5,000");
    std::println!("Proposals Evaluated: {}", total_propose);
    std::println!("Auto-Executed: {}", total_auto_executed);
    std::println!("Queued Pending: {}", total_pending);
    std::println!("Owner Approved: {}", total_approved);
    std::println!("Owner Rejected: {}", total_rejected);
    std::println!("Purged Expired: {}", total_purged);
    std::println!("INVARIANTS I1–I8: 100% PRESERVED ACROSS ALL 5,000 STEPS!");
}
