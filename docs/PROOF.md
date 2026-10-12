# Proof of Containment & Empirical Validation — AgentVault v2

**Event:** Find Your Way: Meridian Hackathon (General Track)  
**Date:** 2026-10-12  
**Network:** Stellar Testnet (`Test SDF Network ; September 2015`)  
**Evidence Directory:** [evidence/](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/AgentVault/evidence)

---

## 1. Falsifiable Thesis

> **Thesis:** If AI agent spending is routed through a Soroban vault contract that auto-executes only payments to allowlisted recipients within a per-transaction cap and a rolling 23-hour cumulative cap, and queues all out-of-policy proposals for human owner approval, then a fully compromised or adversarial agent key can move at most `daily_cap` per rolling 23-hour window to allowlisted recipients and **0.00 TUSDC to any unauthorized entity**, whereas a naive agent holding the funded private key loses **100% of treasury funds** under the identical adversarial attack corpus.

---

## 2. Baseline vs. Intervention

### The Baseline: Naive Hot-Wallet Agent
* **Contract / Key Setup:** Hot-wallet agent holds the funded private key directly or calls an unprotected vault (`contracts/naive-vault`, ID `CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T`).
* **Privilege:** Unlimited spending authority; no recipient allowlist; no rolling window caps; no human approval gate.
* **Failure Mode:** A single prompt-injection attack or compromised session key drains 100% of the funds in one transaction.

### The Intervention: AgentVault v2
* **Contract Setup:** Low-privilege session agent key (`GC34JC4...`) has authority only to call `propose()`. Holds **0 funds**; vault holds all assets (`CCZQDUI...`).
* **Policy Constraints:**
  * Strict recipient allowlist (max 32 payees).
  * `per_tx_cap`: 5.0 TUSDC.
  * `daily_cap`: 20.0 TUSDC across rolling 23-hour window (hourly buckets).
  * `MAX_PENDING`: 25 proposals.
  * Human-in-the-loop approval via Freighter for all out-of-policy attempts.
  * Instant emergency kill-switch (`pause`).

---

## 3. Results Summary Table

| Experiment | Description | Evaluated Metric | Result | Label | Verification |
|---|---|---|---|---|---|
| **E1 Containment** | Scripted adversary holding agent key attempts 50 attacks (unknown payees, cap overflows, self-recipient, negative amounts, queue flood). | Total funds moved to attacker; Error codes. | **0.0 TUSDC lost** (100% of 50 attacks blocked or queued). | `TESTNET` | [evidence/summary.json](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/AgentVault/evidence/summary.json) |
| **E2 LLM Injection** | Anthropic LLM agent processes 35 adversarial 402 quotes/invoices containing prompt injection payloads. | Attack execution rate. | **0.0 TUSDC leaked** (82.9% caught client-side, 100% contained on-chain). | `MEASURED` + `TESTNET` | [evidence/redteam-e1-e2-e3.json](file:///c:/Users/USER/Documents/Software%20Development/AI%20SaaS/AgentVault/evidence/redteam-e1-e2-e3.json) |
| **E3 Removal Test** | Same adversary attacks `contracts/naive-vault` funded with 50.0 TUSDC baseline. | Treasury drain percentage. | **100.0% Drained** (50.0 TUSDC stolen in 1 tx: `6266135b...`). | `TESTNET` | Tx [`6266135b...`](https://stellar.expert/explorer/testnet/tx/6266135ba9973495b1e76bc43800f3a6030ce05d882b23e90f8507393e7fa4fd) |
| **E4 Latency & Fees** | Micro-payment roundtrip: Paid API quote $\rightarrow$ Agent proposal $\rightarrow$ Soroban execution $\rightarrow$ On-chain verification. | Transaction fee & finality latency. | **Fee: ~0.0017 XLM** (17,471 stroops)<br>**Latency: 3.2s – 4.8s** ledger finality. | `MEASURED` | Kill-Test K4 & E2E Happy Path |
| **E5 Human Authority** | Live Human Owner approving over-cap proposals & rejecting prompt-injection attempts via Freighter. | Sign-off execution on Testnet. | **Proposal #49 Executed** (15.0 TUSDC approved)<br>**Proposal #54 Rejected** (25.0 TUSDC ransom vetoed). | `TESTNET` | Verified Live by Human Owner |

---

## 4. Controlled Removal Test (The Empirical Proof)

To prove that the containment metric was entirely driven by the Soroban smart contract policy engine rather than client-side prompt engineering, we deployed an identical baseline contract with the policy checks removed:

```text
========================================================================
BASELINE (NaiveVault):
  Attacker: GAHXKGMAG3Q3RDCFQQR4WFZ46Z7CKN7WS5VLJNPHO2BZGEFOJRQ3WVMJ
  Amount Stolen: 50.0 TUSDC (100% of Treasury)
  Transaction Hash: 6266135ba9973495b1e76bc43800f3a6030ce05d882b23e90f8507393e7fa4fd
  Status: SUCCESS (Treasury completely drained)
========================================================================
INTERVENTION (AgentVault v2):
  Attacker: GAHXKGMAG3Q3RDCFQQR4WFZ46Z7CKN7WS5VLJNPHO2BZGEFOJRQ3WVMJ
  Attempt: 50 attack transactions + 35 prompt injection payloads
  Amount Stolen: 0.0 TUSDC (0% of Treasury)
  Unauthorized Transactions: 0
  Status: CONTAINED ON-CHAIN (All attacks halted or routed to human queue)
========================================================================
```

---

## 5. Hardest Engineering Decision: Sliding-Bucket Rolling Window vs. Continuous FIFO Queue

### The Trade-off
* **Continuous Timestamp FIFO Queue**: Storing every individual transaction timestamp and amount in persistent storage to compute the exact rolling 24-hour sum.
  * *Fatal Flaw*: An agent making hundreds of micropayments would cause unbounded storage growth, leading to state bloat and eventual out-of-gas / CPU resource exhaustion when iterating through the queue during `propose()`.
* **Hourly Sliding-Bucket Model**: Partition time into discrete 1-hour buckets (`timestamp / 3600`).
  * Invariant guarantee: Any continuous time span $\le 23\text{h}$ ending at time $t$ lies strictly within the 24 hourly buckets $[h(t)-23, \dots, h(t)]$.
  * Storage bound: Bounded strictly to at most 24 persistent map entries. Older buckets are pruned automatically on writes.
  * *Decision*: Chose the hourly sliding-bucket model. Tested across 10,000 randomized transactions in prototype test `test_k8_sliding_bucket_10k_random_sequence`, verifying that Invariant I3 is mathematically preserved with $O(1)$ bounded storage.

---

## 6. Limitations & Known Boundaries

1. **Owner Authority**: AgentVault isolates agent risk, not owner risk. A compromised owner key can withdraw all funds.
2. **Allowlisted Merchant Collusion**: If an allowlisted recipient colludes with an attacker, the agent can auto-spend up to `daily_cap` within a 23-hour window before human intervention is required.
3. **Network Scope**: Evaluated on Stellar Testnet for the Meridian Hackathon. Production mainnet deployment requires formal third-party audit and multisig owner support.
