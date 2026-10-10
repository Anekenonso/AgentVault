# AgentVault v2 — Human Owner Action Checklist

This document tracks all manual steps and real-world verifications delegated to the human owner across project phases.

---

## Completed Gates
- [x] **GATE 0**: Toolchain verified, FACTS.md initialized.
- [x] **GATE 1**: Kill-tests K1–K8 executed and recorded in `docs/KILLTESTS.md`.
- [x] **GATE 2**: Contract TDD suite & property tests green (16/16 tests), security review complete.
- [x] **GATE 3**: Testnet deployment live, TypeScript bindings generated & built, smoke test verified.

---

## Phase 4: Agent Runtime & Paid API (NEXT GATE)

- [ ] **1. Check Live Deadline & Submission Form**
  - Open `https://demo.stellarpassport.xyz/hackathons/find-your-way-meridian-hackathon` in your browser.
  - Record the exact live countdown / deadline and required submission form fields in `docs/FACTS.md`.
  - Save a screenshot of the deadline to `evidence/live-page-deadline.png`.
- [ ] **2. Register on Stellar Passport**
  - Log in / create account on Stellar Passport.
  - Join the "Find Your Way: Meridian Hackathon" (General Track).
  - Create or join your team (note: creating an account alone does NOT register you).

---

## Phase 1: Kill-Tests (GATE 1)

- [ ] **K3b. Freighter Testnet Signature Check**
  - Connect your real Freighter wallet on Stellar Testnet.
  - Sign a testnet transaction (delegated when K3b script is ready in Phase 1).
  - Confirm success and record the result in `docs/KILLTESTS.md`.

---

## Phase 5: Web Dashboard Verification (GATE 5)

- [ ] **Freighter Approval Flow in UI**
  - Connect Freighter on Testnet to the dashboard (`http://localhost:3000`).
  - Verify that approving a pending proposal requests signature and submits cleanly.
  - Verify rejection works as expected.

---

## Phase 8 & 9: Submission Checklist (GATES 8 & 9)

- [ ] **1. Review Live Deadline** before final submission.
- [ ] **2. Confirm Testnet Accounts & Contracts** are funded and responsive.
- [ ] **3. Record Demo Video** following `docs/DEMO_SCRIPT.md` (2–3 minutes).
- [ ] **4. Check Repository Visibility & Cleanliness** (public repo, no secrets).
- [ ] **5. Submit via Stellar Passport Portal** using the content prepared in `docs/SUBMISSION_KIT.md`.
- [ ] **6. Confirm Submission Status** in the dashboard and keep services live throughout the judging period.
