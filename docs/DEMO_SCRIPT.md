# GrantGate — 5-Minute Evaluation Demo Script

> **Mandatory Governance Notice:**
> *"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*

---

## ⏱️ Video Breakdown & Walkthrough (Total: 5:00)

| Timestamp | Phase | Screen / View | Action & Narrative | Blueprint Reference |
|---|---|---|---|---|
| **0:00 – 0:45** | **Problem Framing & Architecture** | Homepage / Architecture | Welcome to **GrantGate**, the zero-trust role-based access governance platform for enterprise AI models and datasets. We address the fatal flaw in modern AI pipelines: static bearer tokens and rubber-stamp approvals. GrantGate enforces pure mathematical limits algebra, database-level append-only triggers, and an unforgeable SHA-256 hash-chained audit log. | §1.0, §3.0, §17.2 |
| **0:45 – 1:45** | **The Golden Path: Multi-Party Request & Approval** | `/catalog` → `/requests/new` → `/reviews` → `/grants` | **1.** Requester `Alice` (ML Engineer) browses `/catalog` and selects `customer-churn-model` (Tier 2 Sensitive).<br>**2.** Alice declares purpose *"Customer Support Chatbot Fine-Tuning"*, sets duration (24h), and limits (5,000 records). Notice the real-time secret scanner alerting if credentials are pasted.<br>**3.** Alice submits. Policy routes into 2 sequential review slots.<br>**4.** Switch to reviewer `Carol` (Data Governance). Carol reviews and uses the **Scope Narrowing** tool to tighten records from 5,000 to 2,500 with mandatory rationale. The live `LimitsDiff` highlights the reduction in amber.<br>**5.** Switch to reviewer `David` (Security Admin). David approves Slot 2.<br>**6.** The grant automatically generates! On `/grants`, see the live, server-drift-compensated countdown timer ticking. | §5.0, §6.0, §12.3 |
| **1:45 – 2:45** | **Security Invariants & Edge Case Attacks** | `/requests` → `/simulator` | **1. Separation of Duties (SG-1):** Switch back to `Alice`. Alice attempts to self-approve a pending slot on her own request. The backend immediately rejects with RFC 9457 `SOD_SELF_APPROVAL_FORBIDDEN` and persists a `SECURITY_TAMPER_ATTEMPT` audit event.<br>**2. Emergency Revocation (SG-4):** CISO `Fiona` clicks "Emergency Revoke" on `/grants` with justification *"Suspicious anomaly detected"*. The grant enters terminal `REVOKED` state.<br>**3. PEP Enforcement:** In `/simulator`, attempt an invocation using the revoked grant. The PEP gateway evaluates the deterministic short-circuit trace and halts at Step 1: `GRANT_REVOKED` (DENY), rendering zero data. | §4.0, §9.0, §11.0, §16.0 |
| **2:45 – 3:45** | **Advisory AI Track (Modules 1 & 4)** | `/reviews` (Risk Lens) & `/policy` (Assurance Linter) | **1. Risk Lens (Module 1):** On `/reviews`, inspect the Explainable Risk Dial. A request for 72h access to a critical financial model scores 78/100 (`HIGH RISK`). The factor breakdown attributes +35 to resource criticality and +25 to extended duration. Below, the counterfactual engine recommends: *"Cap duration to 24h (-18 pts)"*. Reviewers can click "Apply" to instantly inject the recommendation into the narrowing editor.<br>**2. Policy Assurance Linter (Module 4):** Navigate to `/policy` and click "Run Assurance Linter". The static analyzer parses `policy.yaml`, verifying 100% role-slot coverage, checking for orphaned roles or loose bounds, and verifying what-if routing projections. | §10.1, §10.4 |
| **3:45 – 4:30** | **Cryptographic Audit Chain Verification** | `/audit` | Every single action—login, submission, narrowing, approval, revocation, and tamper attempt—is chained into SQLite using SHA-256 canonical hashing (`hash = SHA256(prev_hash + canonical_json)`). Click **"Re-verify Chain"**. GrantGate recalculates the entire chain from Genesis (`0000...`) to Head, displaying the bright green **"Chain verified ✓"** badge. Demonstrates full cryptographic compliance with zero external dependencies. | §8.0, §12.3 |
| **4:30 – 5:00** | **Safety Statement & Closing** | App Footer / Safety Banner | Point to the persistent header banner visible on every screen:<br>*"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*<br>GrantGate proves that automated AI governance can be provably secure, mathematically bounded, and developer-friendly. | §12.1, §17.2 |

---

## 🛠️ Verification Checklist for Evaluator

- [x] **Backend Test Suite:** `py -3.13 -m pytest backend/tests -v` (71/71 tests passing, including all 4 named challenge scenarios: `test_separation_of_duties`, `test_expiry`, `test_narrowed_scope`, `test_emergency_revocation`).
- [x] **Edge Case Coverage:** `py -3.13 scripts/check_ec_coverage.py` (65/65 mandatory ECs verified).
- [x] **Sample Access History:** Verified deterministic JSON and CSV exports in `docs/sample_access_history.json` and `docs/sample_access_history.csv`.
- [x] **OpenAPI Schema:** Exported in `backend/openapi.json`.
- [x] **Database Triggers:** 7 active SQLite triggers preventing unauthorized grant insertion, audit tampering, grant mutation, and request mutation.
