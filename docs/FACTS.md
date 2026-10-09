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

- **Unit Test Execution (`cargo test --lib`)**: Passed (`1 passed; 0 failed; finished in 1.05s`).
  - Note: Windows GNU linker has 65,535 export symbol limit on host `cdylib` DLLs; unit tests run cleanly via `cargo test --lib` (testing rlib).
- **WASM Build (`stellar contract build`)**: Passed.
  - Target: `wasm32v1-none`
  - `agentvault_vault.wasm`: 378 bytes optimized
  - `agentvault_naive_vault.wasm`: 378 bytes optimized
