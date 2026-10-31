# GrantGate Technical Architecture Specification

> **Mandatory Governance Notice:**
> *"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*

---

## 1. System Overview

GrantGate is an enterprise-grade governance platform that manages, time-bounds, and cryptographically audits developer access to high-value AI models and datasets.

```mermaid
graph TD
    Client[Frontend SPA / AI Agent] -->|HTTPS + Bearer| Gateway[FastAPI AppShell]
    Gateway --> Auth[Auth & Session Layer]
    Gateway --> ReqService[Request Lifecycle Service]
    Gateway --> RevService[Review & SoD Engine]
    Gateway --> GrantService[Grant & Effective Status Engine]
    Gateway --> PepService[Policy Enforcement Point Gateway]
    Gateway --> AuditService[Chained Audit Service]
    Gateway --> AiLens[Advisory AI: Risk Lens & Linter]

    ReqService --> DB[(SQLite DB + 7 Triggers)]
    RevService --> DB
    GrantService --> DB
    AuditService --> DB

    subgraph Database Security Invariants
        T1[TR_AUDIT_NO_UPDATE_OR_DELETE]
        T2[TR_GRANT_REQUIRES_APPROVED_REQUEST]
        T3[TR_GRANT_SCOPE_IMMUTABLE]
        T4[TR_GRANT_TERMINAL_STATES]
        T5[TR_SLOT_IMMUTABLE_ONCE_DECIDED]
        T6[TR_REQUEST_IMMUTABLE_CONTENT]
    end
    DB --- Database Security Invariants
```

---

## 2. Core Architectural Pillars

### 2.1 Pure Domain Core (Zero I/O)
- **`app/domain/limits.py`**: Mathematical limits algebra. Enforces that narrowing is strictly monotonic:
  $$\text{Limits}_{\text{narrowed}} \subseteq \text{Limits}_{\text{requested}}$$
  The `merge_limits` function computes the formal meet ($\wedge$) across all reviewer slots.
- **`app/domain/sod.py`**: Separation of Duties.
  - **SG-1 (Self-Approval Invariant):** $\text{Requester} \neq \text{Reviewer}_i \quad \forall i$.
  - **SG-2 (Dual-Slot Invariant):** $\text{Reviewer}_i \neq \text{Reviewer}_j \quad \forall i \neq j$.
- **`app/domain/effective.py`**: Derived Effective Status. Grants are evaluated dynamically:
  $$\text{EffectiveStatus}(g, t) = \begin{cases} \text{REVOKED} & \text{if } g.\text{revoked\_at} \neq \text{null} \\ \text{EXPIRED} & \text{if } t \ge g.\text{expires\_at} \\ \text{ACTIVE} & \text{otherwise} \end{cases}$$
- **`app/domain/hashing.py`**: Canonical JSON serialization (RFC 8785 sorting) and SHA-256 chain calculation:
  $$H_i = \text{SHA-256}(H_{i-1} \parallel \text{CanonicalJSON}(E_i))$$
- **`app/domain/pdp.py`**: Deterministic Policy Decision Point evaluation returning an ordered, short-circuit trace.

---

## 3. Database Triggers (Defense-in-Depth)

Even if application code is compromised, SQLite triggers directly block unauthorized state transitions:

1. **`tr_audit_no_update_or_delete`**: Prevents any `UPDATE` or `DELETE` on `audit_events`.
2. **`tr_grant_requires_approved_request`**: Blocks `INSERT INTO grants` unless corresponding `access_requests.status == 'APPROVED'`.
3. **`tr_grant_scope_immutable`**: Prevents mutation of `granted_limits` or `resource_id`.
4. **`tr_grant_terminal_states`**: Enforces that `REVOKED` and `EXPIRED` grants can never transition back to `ACTIVE`.
5. **`tr_slot_immutable_once_decided`**: Blocks updates to slots once status is `APPROVED`, `NARROWED`, or `REJECTED`.
6. **`tr_request_immutable_content`**: Freezes requested limits, resource, and justification once submitted.

---

## 4. Advisory AI Track Architecture

### Module 1: Risk Lens
- **Explainable Scoring (0–100):** Combines resource criticality base score, duration multipliers, record volumes, rate limits, and missing risk controls.
- **Factor Attribution:** Transparent evidence breakdown giving exact numerical contributions.
- **Counterfactual Narrowing:** Searches the parameter space to recommend exact edits that bring requests below risk thresholds.

### Module 4: Policy Assurance Linter
- **Static Analysis:** Validates `config/policy.yaml` for complete role mappings, checks for unreachable states, and ensures multi-party slots exist for critical resources.
- **What-If Routing Simulator:** Projects exact slot routing for any hypothetical request.

---

## 5. Security & Invariant Matrix

| Invariant | Description | Enforcing Layer |
|---|---|---|
| **SG-1** | Requester cannot review/approve own request | Domain Core + Service + DB Audit |
| **SG-2** | No reviewer can decide multiple slots on same request | Domain Core + Service |
| **SG-3** | Narrowing can only shrink bounds, never expand | Domain Limits Algebra + DB Triggers |
| **SG-4** | Emergency Revocation terminates PEP access instantly | PEP Gateway + Effective Status |
| **SG-5** | Audit chain is cryptographically continuous | Canonical SHA-256 + SQLite Triggers |
