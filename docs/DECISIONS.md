# AgentVault v2 — Architecture & Decision Log

This log records non-obvious architecture choices, test assertion modifications, and deviations from assumptions, along with their rationale.

| Date | ID | Category | Context & Decision | Rationale |
|---|---|---|---|---|
| 2026-10-09 | DEC-001 | Architecture | Single project selection: AgentVault v2 | Chosen over MeridianEscrow and other concepts for originality, direct alignment with AI agent autonomy + Soroban auth, and crisp containment metric. |
| 2026-10-09 | DEC-002 | Testing | Removal test via `contracts/naive-vault` | Demonstrates concrete exploitability by proving the naive hot-wallet agent loses 100% of funds under the identical attack vector. |
| 2026-10-09 | DEC-003 | Security | Secrets isolation & DevWallet exclusion | DevWallet exists strictly under `NEXT_PUBLIC_ENABLE_DEV_WALLET=true` in local testing; excluded from production bundles via CI check. |
