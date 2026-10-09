#![no_std]

pub mod types;

#[cfg(test)]
pub mod k8_bucket_proto;

#[cfg(test)]
mod test;

#[cfg(test)]
mod property_test;

use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, BytesN, Env, String, Vec};
use types::{
    DataKey, Error, Policy, Proposal, Status, VaultConfig, INSTANCE_TTL_EXTEND,
    INSTANCE_TTL_THRESHOLD, MAX_ALLOWLIST, MAX_PENDING, MAX_TTL_SECS, MIN_TTL_SECS,
    PERSISTENT_TTL_EXTEND, PERSISTENT_TTL_THRESHOLD,
};

#[contract]
pub struct VaultContract;

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND);
}

fn extend_persistent_ttl(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND);
}

fn validate_policy(policy: &Policy) -> Result<(), Error> {
    if policy.per_tx_cap <= 0 {
        return Err(Error::InvalidPolicy);
    }
    if policy.daily_cap < policy.per_tx_cap {
        return Err(Error::InvalidPolicy);
    }
    if policy.proposal_ttl_secs < MIN_TTL_SECS || policy.proposal_ttl_secs > MAX_TTL_SECS {
        return Err(Error::InvalidPolicy);
    }
    Ok(())
}

fn get_hour_index(timestamp_secs: u64) -> u64 {
    timestamp_secs / 3600
}

fn get_spent_in_window(env: &Env, current_hour: u64) -> Result<i128, Error> {
    let start_hour = current_hour.saturating_sub(23);
    let mut spent: i128 = 0;
    for h in start_hour..=current_hour {
        let key = DataKey::Bucket(h);
        if let Some(amt) = env.storage().persistent().get::<DataKey, i128>(&key) {
            spent = spent.checked_add(amt).ok_or(Error::Overflow)?;
        }
    }
    Ok(spent)
}

#[contractimpl]
#[allow(deprecated)]
impl VaultContract {
    /// Atomic constructor initializing owner, agent, token SAC, and spending policy.
    pub fn __constructor(
        env: Env,
        owner: Address,
        agent: Address,
        token: Address,
        policy: Policy,
    ) -> Result<(), Error> {
        validate_policy(&policy)?;

        let empty_allowlist: Vec<Address> = Vec::new(&env);

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Agent, &agent);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Policy, &policy);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::NextId, &1u64);
        env.storage().instance().set(&DataKey::PendingCount, &0u32);
        env.storage()
            .instance()
            .set(&DataKey::Allowlist, &empty_allowlist);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Autonomous payment proposal by the agent key.
    /// Executes immediately if within policy and allowlisted, else enqueues as Pending.
    pub fn propose(
        env: Env,
        to: Address,
        amount: i128,
        reason_hash: BytesN<32>,
        memo: String,
    ) -> Result<(u64, Status), Error> {
        extend_instance_ttl(&env);

        let agent: Address = env.storage().instance().get(&DataKey::Agent).unwrap();
        agent.require_auth();

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            return Err(Error::Paused);
        }

        let policy: Policy = env.storage().instance().get(&DataKey::Policy).unwrap();
        let now = env.ledger().timestamp();

        if policy.policy_expires_at != 0 && now >= policy.policy_expires_at {
            return Err(Error::PolicyExpired);
        }

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        if to == env.current_contract_address() {
            return Err(Error::InvalidRecipient);
        }

        if memo.len() > 64 {
            return Err(Error::MemoTooLong);
        }

        let mut next_id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap();
        let id = next_id;

        let allowlist: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Allowlist)
            .unwrap_or(Vec::new(&env));

        let current_hour = get_hour_index(now);
        let spent = get_spent_in_window(&env, current_hour)?;

        let is_allowlisted = allowlist.contains(&to);
        let within_per_tx = amount <= policy.per_tx_cap;
        let new_total = spent.checked_add(amount).ok_or(Error::Overflow)?;
        let within_daily = new_total <= policy.daily_cap;

        let within_policy = is_allowlisted && within_per_tx && within_daily;

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        if within_policy {
            let vault_balance = token_client.balance(&env.current_contract_address());
            if vault_balance < amount {
                return Err(Error::InsufficientFunds);
            }

            // Update hourly bucket
            let bucket_key = DataKey::Bucket(current_hour);
            let current_bucket_val = env
                .storage()
                .persistent()
                .get::<DataKey, i128>(&bucket_key)
                .unwrap_or(0);
            let new_bucket_val = current_bucket_val
                .checked_add(amount)
                .ok_or(Error::Overflow)?;
            env.storage().persistent().set(&bucket_key, &new_bucket_val);
            extend_persistent_ttl(&env, &bucket_key);

            // Store executed proposal
            let proposal = Proposal {
                id,
                to: to.clone(),
                amount,
                reason_hash: reason_hash.clone(),
                memo: memo.clone(),
                created_at: now,
                status: Status::Executed,
                auto: true,
            };
            let prop_key = DataKey::Proposal(id);
            env.storage().persistent().set(&prop_key, &proposal);
            extend_persistent_ttl(&env, &prop_key);

            // Monotonic NextId update
            next_id += 1;
            env.storage().instance().set(&DataKey::NextId, &next_id);

            // External token transfer (Checks-Effects-Interactions)
            token_client.transfer(&env.current_contract_address(), &to, &amount);

            // Emit executed event
            env.events().publish(
                (symbol_short!("executed"), id),
                (to, amount, reason_hash, false),
            );

            Ok((id, Status::Executed))
        } else {
            let mut pending_count: u32 = env
                .storage()
                .instance()
                .get(&DataKey::PendingCount)
                .unwrap();
            if pending_count >= MAX_PENDING {
                return Err(Error::QueueFull);
            }

            let proposal = Proposal {
                id,
                to: to.clone(),
                amount,
                reason_hash: reason_hash.clone(),
                memo: memo.clone(),
                created_at: now,
                status: Status::Pending,
                auto: false,
            };
            let prop_key = DataKey::Proposal(id);
            env.storage().persistent().set(&prop_key, &proposal);
            extend_persistent_ttl(&env, &prop_key);

            next_id += 1;
            pending_count += 1;
            env.storage().instance().set(&DataKey::NextId, &next_id);
            env.storage()
                .instance()
                .set(&DataKey::PendingCount, &pending_count);

            env.events()
                .publish((symbol_short!("proposed"), id), (to, amount, reason_hash));

            Ok((id, Status::Pending))
        }
    }

    /// Owner approves a pending proposal.
    /// Does not consume the autonomous agent spending allowance.
    pub fn approve(env: Env, id: u64) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap();
        if paused {
            return Err(Error::Paused);
        }

        let prop_key = DataKey::Proposal(id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&prop_key)
            .ok_or(Error::NotFound)?;

        if proposal.status != Status::Pending {
            return Err(Error::NotPending);
        }

        let policy: Policy = env.storage().instance().get(&DataKey::Policy).unwrap();
        let now = env.ledger().timestamp();

        if now > proposal.created_at + policy.proposal_ttl_secs {
            return Err(Error::ProposalExpired);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let vault_balance = token_client.balance(&env.current_contract_address());
        if vault_balance < proposal.amount {
            return Err(Error::InsufficientFunds);
        }

        // Transition state to Executed
        proposal.status = Status::Executed;
        proposal.auto = false;
        env.storage().persistent().set(&prop_key, &proposal);
        extend_persistent_ttl(&env, &prop_key);

        let mut pending_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PendingCount)
            .unwrap();
        pending_count = pending_count.saturating_sub(1);
        env.storage()
            .instance()
            .set(&DataKey::PendingCount, &pending_count);

        // State written BEFORE token transfer
        token_client.transfer(
            &env.current_contract_address(),
            &proposal.to,
            &proposal.amount,
        );

        env.events().publish(
            (symbol_short!("executed"), id),
            (proposal.to, proposal.amount, proposal.reason_hash, true),
        );

        Ok(())
    }

    /// Owner rejects a pending proposal. Allowed while paused.
    pub fn reject(env: Env, id: u64) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let prop_key = DataKey::Proposal(id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&prop_key)
            .ok_or(Error::NotFound)?;

        if proposal.status != Status::Pending {
            return Err(Error::NotPending);
        }

        proposal.status = Status::Rejected;
        env.storage().persistent().set(&prop_key, &proposal);
        extend_persistent_ttl(&env, &prop_key);

        let mut pending_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PendingCount)
            .unwrap();
        pending_count = pending_count.saturating_sub(1);
        env.storage()
            .instance()
            .set(&DataKey::PendingCount, &pending_count);

        env.events().publish((symbol_short!("rejected"), id), ());

        Ok(())
    }

    /// Publicly callable cleanup of expired pending proposals.
    pub fn purge_expired(env: Env, id: u64) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let prop_key = DataKey::Proposal(id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&prop_key)
            .ok_or(Error::NotFound)?;

        if proposal.status != Status::Pending {
            return Err(Error::NotPending);
        }

        let policy: Policy = env.storage().instance().get(&DataKey::Policy).unwrap();
        let now = env.ledger().timestamp();

        if now <= proposal.created_at + policy.proposal_ttl_secs {
            return Err(Error::NotExpired);
        }

        proposal.status = Status::Expired;
        env.storage().persistent().set(&prop_key, &proposal);
        extend_persistent_ttl(&env, &prop_key);

        let mut pending_count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::PendingCount)
            .unwrap();
        pending_count = pending_count.saturating_sub(1);
        env.storage()
            .instance()
            .set(&DataKey::PendingCount, &pending_count);

        env.events().publish((symbol_short!("expired"), id), ());

        Ok(())
    }

    /// Update spending policy (owner only).
    pub fn set_policy(env: Env, policy: Policy) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        validate_policy(&policy)?;
        env.storage().instance().set(&DataKey::Policy, &policy);

        env.events().publish((symbol_short!("policy"),), ());
        Ok(())
    }

    /// Rotate or revoke agent session key (owner only).
    pub fn set_agent(env: Env, new_agent: Address) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        env.storage().instance().set(&DataKey::Agent, &new_agent);

        env.events().publish((symbol_short!("agent"),), new_agent);
        Ok(())
    }

    /// Update allowlist of authorized recipients (owner only, max 32).
    pub fn set_allowlist(env: Env, list: Vec<Address>) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        if list.len() > MAX_ALLOWLIST {
            return Err(Error::AllowlistTooLarge);
        }

        env.storage().instance().set(&DataKey::Allowlist, &list);

        env.events().publish((symbol_short!("allowlist"),), ());
        Ok(())
    }

    /// Emergency pause kill-switch (owner only).
    pub fn pause(env: Env) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        env.storage().instance().set(&DataKey::Paused, &true);

        env.events().publish((symbol_short!("paused"),), ());
        Ok(())
    }

    /// Unpause vault operations (owner only).
    pub fn unpause(env: Env) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        env.storage().instance().set(&DataKey::Paused, &false);

        env.events().publish((symbol_short!("unpaused"),), ());
        Ok(())
    }

    /// Owner withdraws funds directly from vault (always permitted, even while paused).
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        extend_instance_ttl(&env);

        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        let balance = token_client.balance(&env.current_contract_address());
        if balance < amount {
            return Err(Error::InsufficientFunds);
        }

        token_client.transfer(&env.current_contract_address(), &to, &amount);

        env.events()
            .publish((symbol_short!("withdraw"),), (to, amount));
        Ok(())
    }

    /// Anyone can extend contract instance TTL to prevent archival.
    pub fn bump(env: Env) {
        extend_instance_ttl(&env);
    }

    // =========================================================================
    // VIEWS (Read-only, anyone can query)
    // =========================================================================

    pub fn get_config(env: Env) -> VaultConfig {
        extend_instance_ttl(&env);
        VaultConfig {
            owner: env.storage().instance().get(&DataKey::Owner).unwrap(),
            agent: env.storage().instance().get(&DataKey::Agent).unwrap(),
            token: env.storage().instance().get(&DataKey::Token).unwrap(),
            policy: env.storage().instance().get(&DataKey::Policy).unwrap(),
            paused: env.storage().instance().get(&DataKey::Paused).unwrap(),
            next_id: env.storage().instance().get(&DataKey::NextId).unwrap(),
            pending_count: env
                .storage()
                .instance()
                .get(&DataKey::PendingCount)
                .unwrap(),
            allowlist: env
                .storage()
                .instance()
                .get(&DataKey::Allowlist)
                .unwrap_or(Vec::new(&env)),
        }
    }

    pub fn get_proposal(env: Env, id: u64) -> Option<Proposal> {
        extend_instance_ttl(&env);
        env.storage().persistent().get(&DataKey::Proposal(id))
    }

    pub fn get_proposals(env: Env, start_id: u64, limit: u32) -> Vec<Proposal> {
        extend_instance_ttl(&env);
        let actual_limit = if limit > 20 { 20 } else { limit };
        let mut result = Vec::new(&env);
        let next_id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);

        let mut current_id = start_id;
        while current_id < next_id && result.len() < actual_limit {
            if let Some(prop) = env
                .storage()
                .persistent()
                .get::<DataKey, Proposal>(&DataKey::Proposal(current_id))
            {
                result.push_back(prop);
            }
            current_id += 1;
        }
        result
    }

    pub fn spent_in_window(env: Env) -> Result<i128, Error> {
        extend_instance_ttl(&env);
        let now = env.ledger().timestamp();
        let current_hour = get_hour_index(now);
        get_spent_in_window(&env, current_hour)
    }

    pub fn remaining_allowance(env: Env) -> Result<i128, Error> {
        extend_instance_ttl(&env);
        let policy: Policy = env.storage().instance().get(&DataKey::Policy).unwrap();
        let now = env.ledger().timestamp();
        let current_hour = get_hour_index(now);
        let spent = get_spent_in_window(&env, current_hour)?;
        let rem = policy.daily_cap.saturating_sub(spent);
        Ok(rem)
    }

    pub fn balance(env: Env) -> i128 {
        extend_instance_ttl(&env);
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.balance(&env.current_contract_address())
    }
}
