#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Agent,
    Counter,
}

#[contract]
pub struct AuthTestContract;

#[contractimpl]
impl AuthTestContract {
    pub fn __constructor(env: Env, owner: Address, agent: Address) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Agent, &agent);
        env.storage().instance().set(&DataKey::Counter, &0u32);
    }

    pub fn owner_only_action(env: Env) -> u32 {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap();
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        env.events().publish((symbol_short!("owner_act"),), counter);
        counter
    }

    pub fn agent_action(env: Env, to: Address, amount: i128, memo: String) -> u32 {
        let agent: Address = env.storage().instance().get(&DataKey::Agent).unwrap();
        agent.require_auth();

        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap();
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        env.events().publish((symbol_short!("agent_act"), to), (amount, memo));
        counter
    }

    pub fn get_counter(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap()
    }
}
