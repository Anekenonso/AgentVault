# AgentVault v2 — Human Owner Action Checklist

> [!IMPORTANT]
> **Per Build Plan Rules**: All account creation, wallet credentials, portal registrations, and Freighter manual signatures are strictly handled by the **HUMAN OWNER**. The AI agent does not handle user credentials or external portal logins.

---

## 👤 Owner Account Actions (HUMAN ONLY)

### 1. Stellar Passport & Hackathon Registration
- [ ] **Create / Verify Stellar Passport Account**
  - Navigate to [Stellar Passport](https://demo.stellarpassport.xyz/) and register/sign in.
- [ ] **Join "Find Your Way: Meridian Hackathon"**
  - Open: `https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon`
  - Register under the **General Track**.
  - Note: Creating a Passport account alone does *not* automatically register you for the hackathon.
- [ ] **Create or Join Team**
  - Set team name (e.g. `AgentVault`).
- [ ] **Record Live Countdown & Form Fields**
  - Check the live submission countdown and confirm exact deadline timestamp in `docs/FACTS.md`.
  - Save a screenshot of the official page countdown to `evidence/live-page-deadline.png`.
  - Confirm the required fields in the live submission form.

### 2. Freighter Wallet & Testnet Account
- [ ] **Install & Configure Freighter Extension**
  - Ensure Freighter is set to **Testnet** (Passphrase: `Test SDF Network ; September 2015`).
- [ ] **Fund Owner Account via Friendbot**
  - Fund your Freighter account with testnet XLM via [Friendbot](https://friendbot.stellar.org).
  - Add `TUSDC` trustline for token SAC: `CAKIENWWT4I5HER2XKHQWCEDHFYR2TL63DLYI5S37DJJQ2PSVCX6SFQE`.

---

## 🖥️ Phase 5: Web Dashboard Verification (ACTIVE GATE 5)

Now that the Next.js Web Dashboard is built and compiled (`apps/web`):
- [ ] **Start Local Dashboard**
  - Run `npm run dev:web` (starts on `http://localhost:3000`).
- [ ] **Connect Freighter Wallet**
  - Click **Connect Freighter** in the header.
  - Approve connection prompt in the Freighter popup.
  - Confirm that your G-address appears and network shows `STELLAR TESTNET`.
- [ ] **Test Emergency Kill-Switch**
  - Click **EMERGENCY KILL-SWITCH**.
  - Review the decoded summary in Freighter and sign transaction.
  - Verify that the status chip flips to `KILL-SWITCH ENGAGED (PAUSED)`.
  - Click **Unpause Vault** and sign to restore operational state.
- [ ] **Test Manual Approval Flow**
  - In the **Pending Human Sign-Off Queue**, click **Approve** on a pending proposal.
  - Verify the decoded confirmation modal displays:
    - Target Recipient
    - Amount in TUSDC
    - Proposal ID
    - Memo text
    - Network (Stellar Testnet)
  - Click **Sign with Freighter** and verify transaction completes successfully on-chain.

---

## 🏆 Final Submission Checklist (Phase 8 & 9)

- [ ] **1. Re-check Official Countdown** on the hackathon portal before submission.
- [ ] **2. Clean Repo Secret Scan** (`git status`, verify `.env*`, keys, seeds are absent).
- [ ] **3. Make Repository Public** on GitHub.
- [ ] **4. Record 2–3 Min Demo Video** (following `docs/DEMO_SCRIPT.md`):
  - Show problem statement (unbounded AI agent keys lose 100%).
  - Show live dashboard with allowance meter and 23h rolling cap.
  - Trigger "Attack Playground" showing contract-level containment.
  - Show removal test proof (/proof) with 100% loss baseline on NaiveVault.
- [ ] **5. Submit via Stellar Passport Portal**:
  - Repo URL
  - Demo Video link
  - Project summary & architectural README
- [ ] **6. Verify Entry in Submission Gallery**.

---

## ✅ Completed Automated Gates (Handled by AI Agent)

- [x] **GATE 0**: Toolchain verified, FACTS.md initialized, workspace scaffolded.
- [x] **GATE 1**: Kill-tests K1–K8 verified on Testnet, sliding-bucket prototype verified (10k random sequences).
- [x] **GATE 2**: Contract TDD suite & 5,000-iteration model-based property tests green (16/16 tests passing).
- [x] **GATE 3**: Testnet deployment live (`CCZQDUI...`, `CBFANZ7...`, `CAKIENW...`), TS bindings generated & built, smoke test verified.
- [x] **GATE 4**: Agent runtime, Paid API (HTTP 402 + on-chain verification), E2E Testnet happy path, and Red-team harness (E1, E2, E3 with 17 verified Testnet transactions) complete.
- [x] **GATE 5 (Build & Unit Tests)**: Next.js 15 App Router web dashboard scaffolded, 31 unit tests passing across all packages, production build compiled cleanly with zero DevWallet artifacts.
