# Phase 1: Kill-Tests Register — AgentVault v2

Every kill-test in Phase 1 has been executed against Stellar Testnet and local mathematical models.

---

## Kill-Test Results Summary

| ID | Test Description | Status | Evidence / Transaction Hashes | Label |
|---|---|---|---|---|
| **K1** | Build + deploy with `__constructor` args on testnet | **PASS** | Contract: `CDK7HKEGHZG3WL6UTTNAD54TW6JCC56FZJIHITHBIJUY3QVNG5GY5VPG`<br>Upload Tx: `993b12df2277ae31db440336e35f3c317fcf82d4d985071a182afb32c894ccf7`<br>Deploy Tx: `b47f5e7304ac66c7842bb8b037e60d368e62069671adbd1a3ce0ce9fd77941d7`<br>Verified args: `val = 42`, `owner = GDL4HCY...` | TESTNET |
| **K2** | Self-issued test asset (`TUSDC`), SAC deploy, trustline behavior | **PASS** | SAC Contract: `CB2QSS7HJJPXZMAXX4P2N26GGTO3ZVQ23MPOL4WYXOJD5BEXCEEXEJXR`<br>Mint Tx: `992a0e26c637734020934ac31acc0e30c1da716f047f32fe6271c1f030de96fc`<br>Missing trustline transfer failed cleanly: `HostError: Error(Contract, #13)`<br>Agent trustline Tx: `d098a85e4d4a1055073af7da6bd12f9979f7b535916e60b98a796f07303f0f92`<br>Transfer Tx: `e9175865c75f7dd308ad602552e6c389853ea96f159fa62fab620d1d54656a94` | TESTNET |
| **K2b** | Circle testnet USDC availability check | **VERIFIED** | Found `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` via Circle Faucet. `TUSDC` remains primary. | TESTNET |
| **K3** | Agent `require_auth` vs Owner `require_auth` isolation | **PASS** | Contract: `CDNER65GOHDGFZJNESSOWHZPQACGFGGD2FIXZYZ5PGTQ4GWOIUNLHU6W`<br>Deploy Tx: `4f324232f266dd2722e868368c719043290e0625e2ef48663af2bfb22dd940a3`<br>Agent action Tx: `eb913ab1ea21b68af02e8c23f2956fc90c5126f39887889bcb48f1cdce4d188a`<br>Agent calling owner function blocked cleanly on-chain.<br>Owner action Tx: `b0f39261731bb8f1e0c43e3f72c6b0c0aac3b5db92c9aead31459fe38e2d6880` | TESTNET |
| **K3b** | Real Freighter signs owner approval on testnet | **DELEGATED** | Manual step recorded in `docs/HUMAN_TODO.md` for owner testing via UI. | HUMAN |
| **K4** | Simulate transaction, measure CPU instructions and fees | **PASS** | Instructions: `473,706` (< 0.5% of 100M block budget)<br>Write bytes: `288`<br>Min Resource Fee: `17,471` stroops (`0.0017471` XLM) | TESTNET / MEASURED |
| **K5** | `getEvents` retention and parsing via `scValToNative` | **PASS** | 4 events retrieved from RPC. Decoded topics: `["agent_act", "GDL4HCY..."]`, Data: `[50000000n, "test-payment"]`. | TESTNET |
| **K6** | LLM structured output and Zod validation pipeline | **PASS** | 10/10 benign quotes validated (100%).<br>5/5 adversarial cases strictly rejected (100% containment). BigInt base-units and SHA-256 reason hashes verified. | SIMULATED / REAL |
| **K7** | Stellar Passport public API / stamp discovery | **RESOLVED** | Confirmed Human Passport on mainnet SBTs; no public testnet stamp issuance API for apps. Omitted per plan §A2/§B3; documented as roadmap. | REAL |
| **K8** | Sliding-bucket math prototype vs exact 23h window | **PASS** | 10,000 randomized operations. Invariant I3 preserved 100% (0 violations). Storage strictly bounded to $\le 24$ hourly entries. | MEASURED |

---

## Detailed Findings

### K1: Constructor Initialization
- Stellar CLI `v28.1.0` and Soroban SDK `v29.0.0` natively support `__constructor` args via `-- --arg value`.
- Contract deploy and initialization execute in an atomic transaction, eliminating front-running initialization risks.

### K2: Asset Mechanics & Trustlines
- When a recipient lacks a trustline for a classic-wrapped asset, Soroban reverts the transaction with diagnostic error `#13` (`"trustline entry is missing for account"`).
- Once the recipient establishes a trustline, the SAC transfer succeeds immediately.

### K3 & K4: Authorization & Micropayment Viability
- Soroban's native host-enforced `require_auth` blocks low-privilege keys from calling privileged owner functions at the VM level.
- Typical payment call costs $\approx 0.0017$ XLM ($17,471$ stroops) and $\approx 473,706$ CPU instructions, validating that per-query micropayments are practical and cheap.

### K7: Stellar Passport Integration Decision
- Time-box discovery showed no testnet stamp faucet or third-party issuance contract. Per Rule 1 ("Do not invent facts") and Plan §A2 Problem 5, we do not fake or simulate stamps. AgentVault operates autonomously without depending on external passport stamps.

### K8: Mathematical Soundness
- Tested 10,000 sequential payment attempts with random timestamps and amounts. The hourly bucket approximation guarantees that the sum in any rolling 23-hour interval ending at ledger time $t$ never exceeds `daily_cap`. Maximum storage footprint remained $\le 13$ entries during active simulation (bounded strictly $\le 24$).
