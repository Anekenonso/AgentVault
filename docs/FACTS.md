# AgentVault v2 — Facts Register

All facts, verified toolchain versions, network endpoints, and environmental discoveries are recorded here.
Label definitions: `REAL` | `TESTNET` | `SIMULATED` | `DRY-RUN` | `READ-ONLY` | `MEASURED`.

---

## 1. Hackathon Details & Deadlines

| Item | Status | Value / Source |
|---|---|---|
| Hackathon Event | REAL | Find Your Way: Meridian Hackathon (General Track) |
| Event Window | REAL (secondary) | 1 Sep – 12 Oct 2026 (stellarpassport.xyz) |
| Live Countdown / Deadline | PENDING OWNER | Awaiting human owner confirmation from live page (`https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon`) |
| Submission Form Fields | PENDING OWNER | Awaiting human owner check on live form |
| Official Network | TESTNET | Stellar Testnet (`Test SDF Network ; September 2015`) |
| Judging Criteria | REAL | Technical execution, meaningful use of Stellar, originality, potential impact, user experience, presentation quality |
| Prizes | REAL | 2,000 / 1,000 / 500 / 250 / 250 USDC (General Track) |
| Passport Public API | UNVERIFIED | Time-boxed discovery scheduled for Phase 1 (K7) |

---

## 2. Toolchain & Runtime Versions (Verified 2026-10-09)

| Tool / Package | Label | Verified Version | Notes |
|---|---|---|---|
| `rustc` | REAL | `1.98.0` (88d9e12ae 2026-08-18) | Host: x86_64-pc-windows-gnu |
| `cargo` | REAL | `1.98.0` (797e8a9bc 2026-08-05) | |
| `stellar` CLI | REAL | `28.1.0` (c0f4d0da891bbf214c08b8c5035ae6db80e9a3bd) | stellar-xdr: 28.0.0 |
| `node` | REAL | `v24.19.0` | Node.js runtime |
| `npm` | REAL | `11.17.0` | npm package manager |
| `rustup targets` | REAL | `x86_64-pc-windows-gnu`<br>`wasm32-unknown-unknown`<br>`wasm32v1-none` | `wasm32v1-none` used by `stellar contract build` |
| `soroban-sdk` (crates.io) | REAL | `29.0.0` | Matches network Protocol 29 |
| `@stellar/stellar-sdk` | REAL | `17.2.1` | Latest stable on npm |
| `@stellar/freighter-api` | REAL | `6.0.1` | Latest stable on npm |
| `next` | REAL | `16.4.0` | Next.js App Router |

---

## 3. Network Endpoints (Verified 2026-10-09)

| Endpoint | Label | URL | Status & Details |
|---|---|---|---|
| **Soroban RPC** | TESTNET | `https://soroban-testnet.stellar.org` | **Healthy** (`getHealth`). Latest ledger: ~5106980. Oldest ledger: ~4986021. Retention window: 120,960 ledgers (~7 days). |
| **Horizon** | TESTNET | `https://horizon-testnet.stellar.org` | **Healthy**. Current protocol: `29`. Core supported protocol: `29`. Passphrase: `Test SDF Network ; September 2015`. |
| **Friendbot** | TESTNET | `https://friendbot.stellar.org` | **Healthy**. Responded with expected validation when queried without address. |

---

## 4. Contract Compiler Verification (Phase 0 Check)

- **Unit Test Execution (`cargo test --lib`)**: Passed (`2 passed; 0 failed; finished in 0.10s`).
  - Note: Windows GNU linker has 65,535 export symbol limit on host `cdylib` DLLs; unit tests run cleanly via `cargo test --lib` (testing rlib).
- **WASM Build (`stellar contract build`)**: Passed.
  - Target: `wasm32v1-none`
  - `agentvault_vault.wasm`: 378 bytes optimized
  - `agentvault_naive_vault.wasm`: 378 bytes optimized

---

## 5. Phase 1 Discoveries & Verifications (Kill-Tests K1–K8)

| Item | Verified Value | Evidence |
|---|---|---|
| **Constructor Init (K1)** | Atomic deploy + init via `__constructor` supported on Testnet | Contract: `CDK7HKEGHZG3WL6UTTNAD54TW6JCC56FZJIHITHBIJUY3QVNG5GY5VPG`<br>Deploy Tx: `b47f5e7304ac66c7842bb8b037e60d368e62069671adbd1a3ce0ce9fd77941d7` |
| **SAC Asset (K2)** | Self-issued `TUSDC` deployed via SAC; missing trustline reverts with `#13` | SAC: `CB2QSS7HJJPXZMAXX4P2N26GGTO3ZVQ23MPOL4WYXOJD5BEXCEEXEJXR`<br>Mint Tx: `992a0e26c637734020934ac31acc0e30c1da716f047f32fe6271c1f030de96fc` |
| **Circle USDC (K2b)** | Circle testnet USDC confirmed on Testnet | `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| **Auth Isolation (K3)** | `require_auth` blocks agent from calling owner functions | Contract: `CDNER65GOHDGFZJNESSOWHZPQACGFGGD2FIXZYZ5PGTQ4GWOIUNLHU6W`<br>Deploy Tx: `4f324232f266dd2722e868368c719043290e0625e2ef48663af2bfb22dd940a3` |
| **Gas & Resources (K4)** | CPU: 473,706 insns; Write: 288 bytes; Fee: 17,471 stroops (~0.0017 XLM) | Measured via `rpcServer.simulateTransaction` on testnet |
| **Event Parsing (K5)** | `getEvents` returns topics & data; `scValToNative` parses reliably | Verified on 4 emitted contract events |
| **Schema Bounds (K6)** | 10/10 benign quotes pass; 5/5 adversarial cases rejected by Zod | Tested with decimal validation, BigInt base units, SHA-256 reason hashes |
| **Passport Discovery (K7)** | No public testnet stamp minting API; integration omitted per plan | Confirmed via documentation & API research |
| **Bucket Math (K8)** | Rolling 23h window with hourly buckets preserves Invariant I3 over 10k ops | Verified via test `test_k8_sliding_bucket_10k_random_sequence` |

---

## 6. Phase 3 Testnet Deployments & Bindings (Verified 2026-10-09)

| Entity | Address / Contract ID | Transaction Hash | Explorer Link |
|---|---|---|---|
| **av-owner** | `GCHBPLNJX6BMD6DA2DH5ZGIINHDNAWTWXKMGABT2DAGXCVGROUMPJTB2` | Funded by Friendbot | [Explorer](https://stellar.expert/explorer/testnet/account/GCHBPLNJX6BMD6DA2DH5ZGIINHDNAWTWXKMGABT2DAGXCVGROUMPJTB2) |
| **av-agent** | `GC34JC4UTSPZ2DBO7OSASMBFDXCVFK7S5KNGY4IBTE2DFUWERP57PMOP` | Funded by Friendbot | [Explorer](https://stellar.expert/explorer/testnet/account/GC34JC4UTSPZ2DBO7OSASMBFDXCVFK7S5KNGY4IBTE2DFUWERP57PMOP) |
| **av-issuer** | `GB2XZAAA5HPZGTD2NLJ7QHIGQQI2MPG4FF6VTSNUBRWTQ7BKG6R6EX33` | Funded by Friendbot | [Explorer](https://stellar.expert/explorer/testnet/account/GB2XZAAA5HPZGTD2NLJ7QHIGQQI2MPG4FF6VTSNUBRWTQ7BKG6R6EX33) |
| **av-provider** | `GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK` | Funded by Friendbot | [Explorer](https://stellar.expert/explorer/testnet/account/GAVCZCIPHDPVMENME3ZUZ65V7VEVMIWOOCSLDW6LHVX4TEYRWY7IWBNK) |
| **av-attacker** | `GAHXKGMAG3Q3RDCFQQR4WFZ46Z7CKN7WS5VLJNPHO2BZGEFOJRQ3WVMJ` | Funded by Friendbot | [Explorer](https://stellar.expert/explorer/testnet/account/GAHXKGMAG3Q3RDCFQQR4WFZ46Z7CKN7WS5VLJNPHO2BZGEFOJRQ3WVMJ) |
| **TUSDC SAC** | `CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE` | `e9e111dcc62d90a56ad57cc88a624058a351a631c8acf26dc2120251445539a7` | [Explorer](https://stellar.expert/explorer/testnet/contract/CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE) |
| **AgentVault** | `CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA` | Deploy: `3760ec39d9be3ef6d851c18b3e55d6cc655c16ffe6fa1b315f53b1becf179e2c`<br>Allowlist: `81401febded729547a72aff4b7247b1be366fa40387083ad73d565ed860c0101`<br>Fund: `3c05b815e25d09f31c60a3f9a144c682275e7e5884934ffe3a6da28443312186` | [Explorer](https://stellar.expert/explorer/testnet/contract/CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA) |
| **NaiveVault** | `CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T` | Deploy: `f80df404061860e928d0125f4b817e25566c7409b134e48e4cdd05a03855b9ea`<br>Fund: `90221608709dfb32beedfdbb2d9cb68ef4595208ea2f7450138d5ce3bbde0ebc` | [Explorer](https://stellar.expert/explorer/testnet/contract/CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T) |
| **Auto-Execute Smoke** | N/A | `10fcf2ec76308afef005bc9386733cdb25545dc8e9524868cef393a3dc3384f0` | [Explorer](https://stellar.expert/explorer/testnet/tx/10fcf2ec76308afef005bc9386733cdb25545dc8e9524868cef393a3dc3384f0) |
| **Pending Propose Smoke** | Proposal 4 | `7da6a01e1e23eae17b4d73dee4e557fcf8e50a6c3a34c90b8a64856a2f2a6004` | [Explorer](https://stellar.expert/explorer/testnet/tx/7da6a01e1e23eae17b4d73dee4e557fcf8e50a6c3a34c90b8a64856a2f2a6004) |
| **Owner Approval Smoke** | Proposal 4 Executed | `18549502ef2f7a68d90032bb60d2d6ed254a0c544abce79991be610924f4a817` | [Explorer](https://stellar.expert/explorer/testnet/tx/18549502ef2f7a68d90032bb60d2d6ed254a0c544abce79991be610924f4a817) |
| **TypeScript Bindings** | `packages/vault-client` | Generated via `stellar contract bindings typescript`, compiled via `tsc`, 0 audit vulnerabilities | Tested with `Client` interface on live Testnet |

