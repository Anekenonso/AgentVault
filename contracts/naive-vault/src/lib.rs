// DEMO ONLY — INTENTIONALLY INSECURE — removal-test baseline
#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct NaiveVaultContract;

#[contractimpl]
impl NaiveVaultContract {
    pub fn ping(_env: Env) -> bool {
        true
    }
}
