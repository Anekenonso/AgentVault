# Security Review & Threat Coverage Matrix — AgentVault v2

This document audits the implementation against every threat listed in §B4 of the build specification, mapping each threat to its automated test and verification evidence.

---

## 1. Threat Mitigation Matrix

| Threat | Specific Mitigation | Automated Test Coverage | Result |
|---|---|---|---|
| **1. Stolen/jailbroken agent key** | Agent holds zero funds; spending bounded on-chain by allowlist and caps (I1–I3); owner can rotate/pause. | `test_propose_unknown_recipient_enqueues_pending`<br>`test_propose_over_per_tx_cap_enqueues_pending`<br>`test_strict_auth_isolation`<br>`test_model_based_property_invariants_5000_operations` | **VERIFIED** |
| **2. Prompt injection via 402 quote** | Untrusted quote parsed through strict Zod schema; unauthorized payee or amount triggers contract Pending queue. | `k6_llm_structured_output.ts`<br>`test_propose_unknown_recipient_enqueues_pending` | **VERIFIED** |
| **3. Drain via many small payments** | Rolling 23h cumulative cap across hourly buckets; total bounded strictly by `daily_cap`. | `test_rolling_window_bucket_fall_off`<br>`test_propose_exceed_daily_cap_enqueues_pending`<br>`test_k8_sliding_bucket_10k_random_sequence` | **VERIFIED** |
| **4. Boundary burst across daily edge** | Continuous 24 hourly buckets `[h-23..=h]` rather than a fixed calendar midnight reset. | `test_rolling_window_bucket_fall_off`<br>`test_k8_sliding_bucket_10k_random_sequence` | **VERIFIED** |
| **5. Replay attacks** | Monotonic sequential `id`; terminal states (`Executed`, `Rejected`, `Expired`); double-spend reverts. | `test_approve_reject_purge_flows`<br>`test_model_based_property_invariants_5000_operations` | **VERIFIED** |
| **6. Initialization front-running** | Atomic deployment and initialization using Soroban `__constructor` args. | `test_constructor_validation`<br>Testnet K1 deploy: `CDK7HKE...` | **VERIFIED** |
| **7. Storage-exhaustion / DoS by agent** | `MAX_PENDING = 25` queue limit; `MAX_ALLOWLIST = 32`; memo $\le$ 64 bytes; public `purge_expired`. | `test_queue_full_rejection`<br>`test_owner_admin_functions_and_bounds`<br>`test_propose_input_rejections`<br>`test_approve_reject_purge_flows` | **VERIFIED** |
| **8. State archival (TTL expiration)** | Automatic instance TTL extension (`17,280` threshold to `120,960` ledgers); persistent entries extended on writes; public `bump()`. | `VaultContract::bump`<br>`extend_instance_ttl`<br>`extend_persistent_ttl` | **VERIFIED** |
| **9. Integer overflow / negative amounts** | `i128` types, checked arithmetic (`checked_add`, `checked_sub`), release profile `overflow-checks = true`. | `test_propose_input_rejections`<br>`test_insufficient_funds_reverts_with_no_state_change` | **VERIFIED** |
| **10. Recipient lacks trustline** | Soroban SAC reverts atomically with `#13` if trustline missing; contract state does not update if token call reverts. | `test_propose_auto_executed_happy_path`<br>Testnet K2 execution | **VERIFIED** |
| **11. Reentrancy** | Soroban host blocks reentrancy by default; Checks-Effects-Interactions strictly applied (state written before token transfer). | `VaultContract::propose`<br>`VaultContract::approve` | **VERIFIED** |
| **12. Malicious frontend inputs** | UI displays decoded on-chain simulation summaries; strict TypeScript schema. | Frontend design (Phase 5) | **PLANNED** |
| **13. LLM API cost abuse** | Deterministic mock fallback; server-side rate limits and fixed test scenarios. | `scripts/killtests/k6_llm_structured_output.ts` | **VERIFIED** |
| **14. Secrets exposure** | Private keys never committed (`.env.local` ignored); DevWallet strictly excluded from production build. | Checked by CI & secret scans | **VERIFIED** |
| **15. Supply chain attack** | Lockfiles committed; dependencies audited via `npm audit` and pinned cargo versions. | `npm audit` (0 vulnerabilities) | **VERIFIED** |
| **16. Network confusion** | Hardcoded testnet passphrase check; Freighter network verification. | `k2_sac_trustline.ts`<br>`k3_k4_k5_test.ts` | **VERIFIED** |

---

## 2. Static Analysis & Linters Audit

- **Cargo Clippy**:
  ```text
  cargo clippy -- -D warnings
  Result: 0 warnings, 0 errors
  ```
- **Cargo Fmt**:
  ```text
  cargo fmt --check
  Result: All files cleanly formatted according to standard Rust style
  ```
- **NPM Supply Chain Audit**:
  ```text
  npm audit
  Result: 0 vulnerabilities found
  ```
- **WASM Optimization**:
  - `agentvault_vault.wasm`: 13,766 bytes (13.4 KB) optimized.
  - `agentvault_naive_vault.wasm`: 1,873 bytes (1.8 KB) optimized.
  - Hashes verified distinct.
