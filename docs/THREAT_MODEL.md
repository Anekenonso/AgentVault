# Threat Model and Invariants — AgentVault v2

## Actors
- **Owner**: Human, Freighter, G-address. Has ultimate control over policy, allowlist, agent rotation, pause, and withdrawal.
- **Agent**: Session key, G-address, holds only XLM for gas fees, holds zero vault funds.
- **Recipient**: Target of payment (provider/merchant).
- **Public**: Anyone on the Stellar network (can inspect state, call view functions, or call `purge_expired` / `bump`).
- **Attacker**: Adversary who may fully control the agent key, the agent's prompts, paid API responses, or public frontend inputs.

## Assets
- Funds deposited in the vault contract.
- Owner authority.
- Availability of the kill-switch / pause mechanism.

## Invariants (I1–I8)

| ID | Invariant |
|---|---|
| **I1** | A transfer initiated by the agent without human approval only ever goes to an allowlisted address. |
| **I2** | Each such transfer $\le$ `per_tx_cap`. |
| **I3** | The sum of such transfers in any rolling 23-hour span $\le$ `daily_cap` (hourly buckets). |
| **I4** | Only owner or agent (as specified) can change state; the only public state-changing function is `purge_expired`, which can only move an expired Pending proposal to Expired. |
| **I5** | A proposal executes at most once; Executed, Rejected, and Expired are terminal states. |
| **I6** | Vault balance decreases only by executed proposals and owner `withdraw`. |
| **I7** | While paused, `propose` and `approve` have no effect (they revert); `withdraw` still works. |
| **I8** | The agent key cannot call any owner function. |

---

## Threats and Mitigations

| Threat | Mitigation |
|---|---|
| **Stolen/jailbroken agent key** | Agent holds no funds; bounded by I1–I3; owner can call `set_agent` to rotate/revoke; emergency `pause`. |
| **Prompt injection via 402 quote / invoice text** | LLM output is untrusted $\rightarrow$ strict schema validation (`zod`) $\rightarrow$ on-chain policy enforcement. Red-team corpus measures LLM compliance separately from contract containment. |
| **Drain via many small payments** | Rolling 23h cap with hourly buckets; strict allowlist. |
| **Boundary burst (two caps across fixed daily edge)** | Rolling hourly buckets, not a fixed daily reset. |
| **Replay** | Proposal IDs are monotonic and single-use; status flip before external token transfer; Stellar auth nonces/expiry handled by network; paid API tracks redeemed invoice IDs. |
| **Init front-running** | Deploy with `__constructor` so owner/agent/token/policy are set atomically. Fallback: single deploy+init atomic script if constructor args unsupported. |
| **Storage-exhaustion / DoS by agent** | `MAX_PENDING = 25` open proposals; `MAX_ALLOWLIST = 32`; memo $\le$ 64 bytes; public `purge_expired`. |
| **Archival of state (TTL)** | Extend instance TTL on every call; extend TTL on proposal and bucket entries when written; owner `bump()`. |
| **Integer issues** | `i128` amounts, checked `> 0`, checked arithmetic (`checked_add`, `checked_sub`), `overflow-checks = true` in release profile; explicit 7-decimal base units ($1.0 = 10\,000\,000$). |
| **Recipient lacks trustline (classic G-address)** | Transfer fails and whole transaction reverts atomically. Tested in K2; surfaced cleanly in UI. |
| **Reentrancy** | Soroban blocks contract re-entry by default; checks-effects-interactions adhered to (state written before token call). |
| **Malicious / compromised frontend** | Decoded transaction summary displayed before signing; strict CSP; no `dangerouslySetInnerHTML`; memo rendered as text; network check requires testnet. |
| **LLM cost abuse on public demo** | Server-side IP rate-limiting + global daily budget cap; fixed scenario buttons; custom input limited to $\le$ 500 characters. |
| **Secrets exposure** | Agent key + LLM key server-side only (never `NEXT_PUBLIC_`); test-only DevWallet absent from production build (enforced by CI). |
| **Supply chain** | Pinned dependencies, lockfiles committed, `npm audit`, `cargo audit`. |
| **Wrong network** | Testnet passphrase checked in every signer path. |

---

## Explicit Non-Goals
- Not audited by third party (hackathon prototype).
- Testnet only.
- Single owner (no multisig or multi-step ownership transfer yet).
- Owner-approved payments do not consume the agent allowance.
- Limits are denominated in a single token.
