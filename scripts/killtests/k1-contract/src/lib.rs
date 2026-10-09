#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Val,
}

#[contract]
pub struct K1Contract;

#[contractimpl]
impl K1Contract {
    pub fn __constructor(env: Env, owner: Address, val: u32) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Val, &val);
    }

    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Owner).unwrap()
    }

    pub fn get_val(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Val).unwrap()
    }
}
