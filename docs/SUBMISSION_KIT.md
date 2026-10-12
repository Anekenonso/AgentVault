# AgentVault v2 — Official Hackathon Submission Kit
**Find Your Way: Meridian Hackathon (General Track)**

Use this superset document to copy-paste into the official Stellar Passport hackathon submission form.

---

## 1. Core Metadata

* **Project Title:** AgentVault v2
* **Tagline / One-Liner (116 chars):**  
  `A Soroban vault letting AI agents pay within hard on-chain limits while humans keep final authority over spending.`
* **Track:** General Track
* **License:** MIT License (Open Source)

---

## 2. Project Descriptions

### Short Description (150 Words)
Developers running autonomous AI agents face a dilemma: giving an agent a funded hot-wallet risks total fund loss via prompt injection or hallucinations, while requiring human approval for every micro-transaction destroys autonomy.

AgentVault v2 solves this by decoupling intelligence from authority. Agent session keys hold zero funds and can only submit payment proposals to a Soroban smart contract. The contract enforces hard on-chain spending bounds: payments to allowlisted recipients under both a per-transaction limit (5.0 TUSDC) and a rolling 23-hour cumulative cap (20.0 TUSDC) auto-execute in ~4 seconds. Anything outside policy—unknown payees, cap overflows, or jailbreak attempts—is shunted to a human-in-the-loop pending queue with an emergency kill-switch.

Tested over 50 adversarial attacks on Stellar Testnet, AgentVault achieved 0.00 TUSDC leaked to attackers, whereas a naive hot-wallet agent lost 100% of its treasury in a single transaction under the identical attack.

### Full Description (400 Words)
Autonomous AI agents increasingly need to transact economically—purchasing compute, paying for proprietary API access, and executing data queries via HTTP 402 protocols. However, granting spending authority to LLMs introduces critical security vulnerabilities: prompt injection in untrusted invoices, tool-use hijacking, and software errors can drain an entire treasury.

AgentVault v2 introduces on-chain policy containment for autonomous AI agents on Stellar Soroban. Rather than trusting off-chain guardrails or forcing humans to approve every payment, AgentVault enforces authority boundaries directly in smart contract code: *AI handles ambiguity; deterministic code handles authority.*

**Architecture & Mechanism:**
1. **Low-Privilege Agent Session Key**: The agent holds only minimal XLM for transaction fees and holds zero treasury tokens. It possesses permission solely to invoke `propose()`.
2. **Autonomous Policy Engine**: The Soroban vault automatically checks incoming proposals against:
   * A dynamic allowlist of authorized merchant recipients (max 32).
   * A per-transaction cap (e.g. 5.0 TUSDC).
   * A rolling 23-hour sliding-window budget (e.g. 20.0 TUSDC) implemented via persistent hourly buckets that prune automatically.
3. **Deterministic Settlement & Audit Stream**: Policy-compliant proposals auto-execute via the Stellar Asset Contract (SAC), emitting structured events (`"executed"`) containing payment reason hashes that paid APIs verify on-chain before unlocking premium data.
4. **Human Authority Gate & Kill-Switch**: Any out-of-policy attempt—prompt-injection overrides, ransom demands, or cap bursts—is contained on-chain and queued into a pending sign-off queue. The human owner signs approvals or rejections via Freighter wallet, with an emergency kill-switch (`pause()`) to halt all operations instantly.

**Empirical Proof & Verification:**
We validated AgentVault v2 empirically on Stellar Testnet across five experiments:
* **E1 (Containment)**: 50/50 scripted adversarial attacks blocked or queued; 0.00 TUSDC leaked to attackers.
* **E2 (LLM Injection)**: 35 real adversarial prompt injection invoices evaluated with Anthropic Claude; 100% contained on-chain.
* **E3 (Controlled Removal Test)**: The same attack on an identical contract without policy checks drained 50.0 TUSDC (100% total treasury loss) in 1 transaction (`6266135b...`).
* **E4 (Performance)**: Measured fee: ~0.0017 XLM per proposal; ledger finality: 3.2s – 4.8s.
* **E5 (Human Path)**: Live Testnet approvals and rejections verified with Freighter.

---

## 3. How Stellar is Used (100 Words)
Stellar Soroban is load-bearing to our core thesis. We utilize Soroban’s native `require_auth` architecture to enforce cryptographic separation between the human owner and the low-privilege agent session key. Payments execute atomically using the Stellar Asset Contract (SAC) with ledger-timestamped hourly storage buckets that preserve rolling 23-hour spending caps. Structured contract events serve as verifiable, tamper-proof payment receipts for HTTP 402 API gateways. Stellar’s sub-5-second finality and sub-cent fees make frequent, automated agent micro-transactions practical where higher-fee chains would make continuous on-chain policy enforcement cost-prohibitive.

---

## 4. Key Links & Deployed Contracts

* **Network:** Stellar Testnet (`Test SDF Network ; September 2015`)
* **RPC Endpoint:** `https://soroban-testnet.stellar.org`
* **AgentVault Contract ID:** [`CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA`](https://stellar.expert/explorer/testnet/contract/CCZQDUIODGUVEWKTHRIUUXOSIOLYFDSGKDQQFBVEJ2BAXBKWPQ7P2AYA)
* **Naive Baseline Contract ID:** [`CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T`](https://stellar.expert/explorer/testnet/contract/CBFANZ76QRXYHWRROG7QDSSBNTD3334HOT3ORT7X5NOUPXXMSOGDMI3T)
* **TUSDC SAC Token ID:** [`CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE`](https://stellar.expert/explorer/testnet/contract/CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE)

### Verified Key Transaction Receipts (Explorer Links)

1. **Controlled Removal Test (100% Drain Baseline):**  
   [`6266135ba9973495b1e76bc43800f3a6030ce05d882b23e90f8507393e7fa4fd`](https://stellar.expert/explorer/testnet/tx/6266135ba9973495b1e76bc43800f3a6030ce05d882b23e90f8507393e7fa4fd)
2. **Autonomous End-to-End Micro-Payment (HTTP 402 Flow):**  
   [`a3b8574eec9f27e7f97e52c50529340b4654339538dce57ad5831d1730ac5a8f`](https://stellar.expert/explorer/testnet/tx/a3b8574eec9f27e7f97e52c50529340b4654339538dce57ad5831d1730ac5a8f)
3. **Vault Contract Deployment:**  
   [`3760ec39d9be3ef6d851c18b3e55d6cc655c16ffe6fa1b315f53b1becf179e2c`](https://stellar.expert/explorer/testnet/tx/3760ec39d9be3ef6d851c18b3e55d6cc655c16ffe6fa1b315f53b1becf179e2c)
4. **Live Human Owner Over-Cap Approval (Proposal #49):**  
   [`41ecdf456748a14ffc1868305f884391629fb8a9d1645e7f8d68dcb57e7eb16c`](https://stellar.expert/explorer/testnet/tx/41ecdf456748a14ffc1868305f884391629fb8a9d1645e7f8d68dcb57e7eb16c)
5. **Live Human Owner Prompt-Injection Veto (Proposal #54):**  
   [`7a7167a54b391ea964dfc4a165fbb7efba6848039c1482b4a53237eb3bf4fa54`](https://stellar.expert/explorer/testnet/tx/7a7167a54b391ea964dfc4a165fbb7efba6848039c1482b4a53237eb3bf4fa54)
6. **Emergency Kill-Switch (Pause) Activation:**  
   [`3c246f47738ef9ea6664982a5c8df4f54d24ee312d83f4b6ad0d4f3b1456a73c`](https://stellar.expert/explorer/testnet/tx/3c246f47738ef9ea6664982a5c8df4f54d24ee312d83f4b6ad0d4f3b1456a73c)

---

## 5. Known Limitations & Roadmap

* **Single Owner**: Current version implements single-owner governance; multi-sig and passkey (`__check_auth`) support is slated for hackathon roadmap.
* **Single Denomination**: Limits are denominated in one token (`TUSDC`); multi-token dynamic exchange pricing planned.
* **Testnet Only**: Not audited by a third-party firm; mainnet release scheduled post-audit.
