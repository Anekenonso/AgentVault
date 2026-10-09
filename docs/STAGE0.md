# Stage 0 Brief — AgentVault v2

1. **Problem:** Developers running AI agents that must pay for services struggle to grant spending ability safely because an agent holding a funded key can be drained by prompt injection or a bug, while requiring human sign-off for every payment kills autonomy.
2. **Thesis (falsifiable):** If agent spending is routed through a Soroban vault that auto-executes only payments to allowlisted recipients within a per-transaction cap and a rolling 23-hour cap, and queues everything else for owner approval, then a fully adversarial agent key can move at most `daily_cap` per rolling 23 hours to allowlisted recipients and **0** to anyone else, whereas a naive agent holding the funded key loses 100% of funds. Measured over a fixed attack corpus on testnet.
3. **Invariants (must never happen):** see `docs/THREAT_MODEL.md` invariants I1–I8.
4. **Why AI / agent:** The LLM interprets messy inputs (a 402 quote, an invoice, a task description) into a structured payment proposal. **Code enforces:** amounts, recipients, caps, expiry, auth, replay. **Human approves:** anything outside policy, plus all policy/allowlist/pause/withdraw changes.
5. **Load-bearing tech:** Soroban contract policy + auth. Remove it → the naive-vault experiment shows total loss.
6. **Most dangerous assumption:** (a) Soroban `require_auth` with a low-privilege agent key plus on-chain checks gives the claimed bound with usable fees/latency; (b) the owner approval flow works smoothly through Freighter. Kill-tested in Phase 1 (K2, K3, K5).
7. **Proof experiment:** Baseline (naive hot-wallet) → Intervention (AgentVault) → Result (funds lost; blocked attempts; latency; fees). See Plan §B6.
8. **Demo moment:** A prompt-injected agent tries to wire everything to an attacker; the explorer shows the contract rejecting it; then the same attack on the naive vault drains it.
9. **Distribution hook:** "We tried to rob our own AI agent 50 times. Here's the receipt." (thread + repo + live dashboard).
