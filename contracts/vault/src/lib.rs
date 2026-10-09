#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    pub fn ping(_env: Env) -> bool {
        true
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_ping() {
        let env = Env::default();
        let contract_id = env.register(VaultContract, ());
        let client = VaultContractClient::new(&env, &contract_id);
        assert!(client.ping());
    }
}
