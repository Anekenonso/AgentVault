// DEMO ONLY — INTENTIONALLY INSECURE — removal-test baseline
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Agent,
    Token,
}

#[contract]
pub struct NaiveVaultContract;

#[contractimpl]
impl NaiveVaultContract {
    pub fn __constructor(env: Env, owner: Address, agent: Address, token: Address) {
        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Agent, &agent);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// INSECURE: agent can transfer any amount to ANY recipient without cap, allowlist, or queue!
    pub fn pay(env: Env, to: Address, amount: i128) {
        let agent: Address = env.storage().instance().get(&DataKey::Agent).unwrap();
        agent.require_auth();

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);

        token_client.transfer(&env.current_contract_address(), &to, &amount);
    }

    pub fn balance(env: Env) -> i128 {
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.balance(&env.current_contract_address())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{token, Address, Env};

    #[test]
    fn test_naive_vault_drain_removal_test() {
        let env = Env::default();
        env.mock_all_auths();

        let owner = Address::generate(&env);
        let agent = Address::generate(&env);
        let attacker = Address::generate(&env);

        let token_admin = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(token_admin)
            .address();

        let vault = env.register(NaiveVaultContract, (&owner, &agent, &token));
        let client = NaiveVaultContractClient::new(&env, &vault);

        // Fund naive vault with 100 tokens
        let token_admin_client = token::StellarAssetClient::new(&env, &token);
        token_admin_client.mint(&vault, &100_0000000);
        assert_eq!(client.balance(), 100_0000000);

        // Attacker / compromised agent calls pay for entire balance to unknown attacker address
        client.pay(&attacker, &100_0000000);

        // Demonstrates total drain (100% loss)
        assert_eq!(client.balance(), 0);
        let token_client = token::Client::new(&env, &token);
        assert_eq!(token_client.balance(&attacker), 100_0000000);
    }
}
