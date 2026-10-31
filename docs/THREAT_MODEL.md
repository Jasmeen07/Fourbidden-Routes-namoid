# GrantGate Threat Model & Security Analysis

> **Mandatory Governance Notice:**
> *"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*

---

## 1. Threat Actors & Capabilities

| Threat Actor | Description & Motivation | Assumed Capabilities |
|---|---|---|
| **Malicious Requester (Insider)** | An authorized employee seeking unauthorized access to sensitive datasets or model parameters. | Has valid corporate OIDC credentials; can craft arbitrary API requests and forge UI inputs. |
| **Colluding / Compromised Reviewer** | A reviewer attempting to bypass governance controls or fast-track requests without oversight. | Possesses elevated review roles (`DATA_GOVERNANCE`, `SECURITY_ADMIN`). |
| **Rogue Database Administrator** | An operator with direct physical or shell access to the underlying SQLite database file. | Can execute arbitrary SQL queries, modify tables, and alter system clocks. |
| **Network Eavesdropper / MitM** | An adversary attempting to intercept tokens, replay callbacks, or hijack active sessions. | Can inspect unencrypted traffic, modify query params, and forge HTTP requests. |

---

## 2. Attack Vectors & Mitigations

### 2.1 Vector 1: Self-Approval & Rubber-Stamping (SG-1 Bypass)
- **Attack:** Requester Alice crafts a request, gains access to a review slot, and sends an approval decision.
- **GrantGate Defense:** 
  1. Pure domain function `sod.validate_reviewer_eligibility()` verifies `requester_id != reviewer_id`.
  2. If Alice attempts self-approval, the request is immediately rejected with RFC 9457 `SOD_SELF_APPROVAL_FORBIDDEN`.
  3. A tamper event `SECURITY_TAMPER_ATTEMPT` is committed immediately to the audit log, surviving transaction rollbacks.

### 2.2 Vector 2: Scope Expansion via Malicious "Narrowing" (SG-3)
- **Attack:** A compromised reviewer modifies the requested scope during review, expanding max records from 1,000 to 1,000,000.
- **GrantGate Defense:**
  1. The limits algebra (`validate_narrowing`) enforces strict subset inclusion: $\text{Narrowed} \subseteq \text{Requested}$.
  2. Any attempted expansion raises `LimitsExpansionError` and aborts the review.
  3. The SQLite trigger `tr_grant_scope_immutable` guarantees that once a grant is issued, its scope can never be altered.

### 2.3 Vector 3: Stale Grant Exploitation / Clock Skew
- **Attack:** An attacker attempts to use an expired grant or rolls back local client clocks to extend active access.
- **GrantGate Defense:**
  1. Derived effective status is computed on every evaluation using the authoritative server clock.
  2. Grants never trust cached database status strings.
  3. Once marked `REVOKED`, SQLite trigger `tr_grant_terminal_states` aborts any attempt to re-activate the grant.

### 2.4 Vector 4: Direct Database Modification & Log Deletion
- **Attack:** An operator with database access attempts to `UPDATE` or `DELETE` audit events to hide evidence of unauthorized access.
- **GrantGate Defense:**
  1. Database trigger `tr_audit_no_update_or_delete` raises an abort error on any `UPDATE` or `DELETE` statement.
  2. Cryptographic SHA-256 chaining binds every event to its predecessor. Any altered byte breaks the entire chain verification verified by `/api/audit/verify`.

### 2.5 Vector 5: Secret Leaking in Justifications
- **Attack:** A user accidentally pastes production OpenAI API keys (`sk-proj-...`), AWS credentials (`AKIA...`), or Bearer tokens into request justification fields.
- **GrantGate Defense:**
  1. Real-time client-side regex detection alerts the user immediately.
  2. Backend validation rejects requests containing credential patterns (EC-R05), preventing credential leakage into logs.

### 2.6 Vector 6: Session Fixation & CSRF Attacks
- **Attack:** An adversary pre-creates a session cookie or triggers cross-origin mutating requests.
- **GrantGate Defense:**
  1. Upon successful OIDC callback, session IDs are rotated to prevent session fixation (EC-A05).
  2. All state-mutating HTTP methods require matching `X-CSRF-Token` headers bound to the authenticated session.
