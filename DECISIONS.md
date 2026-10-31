# Engineering Decisions — GrantGate

> **Mandatory Governance Notice:**
> *"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*

---

## Scope

### What was completed within the timebox:
1. **Pure Domain Core:** A dependency-free core (`app/domain/`) implementing monotonic limits algebra ($\text{Narrowed} \subseteq \text{Requested}$), meet operator ($\wedge$), Separation of Duties (SG-1 requester self-approval prevention, SG-2 dual-slot review prevention), derived effective status, deterministic Policy Decision Point (PDP) evaluation, and RFC 8785 canonical JSON hash chaining.
2. **Database Defense-in-Depth:** 7 SQLite triggers that enforce invariants (append-only audit trail, approved-request grant dependency, grant scope immutability, terminal grant states, slot decision freezing, and request content freezing) directly in the database engine.
3. **Backend API & Services:** Complete FastAPI services for request submission, multi-slot review routing, dynamic grant generation, break-glass emergency revocation, Policy Enforcement Point (PEP) gateway invocation simulation with watermark banners, and continuous cryptographic audit verification (`/api/audit/verify`).
4. **Advisory AI Track:** Module 1 (Risk Lens with explainable scoring 0–100, factor attribution weights, and counterfactual narrowing recommendations) and Module 4 (Policy-as-Code Assurance Linter with static checks and what-if routing projections).
5. **The Five Complementary Innovations (Updated Proposal):**
   - **Innovation 1:** Intelligent Risk Scoring and Recommendations (explainable weights, 0–100 score, counterfactual narrowing tips).
   - **Innovation 2:** Smart Priority Queue Management (Urgency vs. Risk scoring, SLA countdowns, waiting starvation escalation, and Approval Bottleneck Detection).
   - **Innovation 3:** Intelligent Approval Assistance (Role-tailored contextual briefs for Manager, Risk Reviewer, and Resource Owner, complete with decision lineage).
   - **Innovation 4:** Purpose-Bound Access Enforcement & Violation Detection (Runtime operation-level purpose validation, scope enforcement, security alerts to resource owners, and interactive PEP simulator preset scenarios).
   - **Innovation 5:** Smart Access Utilization and Early Revocation (Runtime invocation tracking, last-used timestamp, dormancy detection, and requester proactive early release).
6. **Testing & Coverage:** 100% coverage of the 65 mandatory Edge Cases (EC-01 to EC-65) across 75 pytest tests, including the 4 named challenge scenarios (`test_separation_of_duties`, `test_expiry`, `test_narrowed_scope`, `test_emergency_revocation`) and dedicated innovation test suites.
7. **Executive UI Redesign (Warm Beige & Sand Palette):** A modern React + TypeScript dashboard completely redesigned in warm beige (`#fbf9f4`), sand (`#f4efe6`), and terracotta (`#c2410c`), eliminating dark blue-black panels and low-contrast typography for executive readability.
8. **Deterministic Sample History:** Generated and verified 14-event audit trail exported in `docs/sample_access_history.json` and `docs/sample_access_history.csv`.

### What was left out:
- Connection to live third-party AI models (strictly avoided in accordance with the mock-first safety boundary and Blueprint §15.2).
- Distributed multi-region consensus (single-node SQLite with WAL mode and `BEGIN IMMEDIATE` was prioritized for deterministic consistency).

---

## Architecture

GrantGate follows a strict three-tier onion architecture:
```
API (FastAPI) ──► Services (Business Logic) ──► Pure Domain Core (Zero I/O)
     ▲                                                   │
     │                                                   ▼
Database Layer (SQLAlchemy + 7 SQLite Triggers) ◄────────┘
```

- **Domain Layer (`backend/app/domain/`):** Pure Python functions with zero dependencies on database, networking, or time. Authoritative time is injected via an explicit `Clock` interface.
- **Service Layer (`backend/app/services/`):** Orchestrates transactions, manages audit event emissions in the same transaction as state changes, and coordinates review slots.
- **Enforcement at the Boundary:** UI controls (such as disabling the approve button on self-requests) are treated strictly as cosmetic convenience. The backend and database triggers reject unauthorized attempts with RFC 9457 `application/problem+json` error payloads regardless of client-side bypasses.

---

## Security and Privacy

### State & Secrets Management:
- **Zero Secrets in Repo:** Environment variables are configured via `.env.example`.
- **Secret Pattern Scanning:** Justifications and request parameters are scanned in real-time (regex: `sk-proj-`, `AIzaSy`, `Bearer `, `ghp_`, `AKIA`) and rejected if sensitive tokens are detected (EC-R05).
- **Session Security:** OIDC sessions use opaque 48-byte cryptographically random tokens stored hashed (SHA-256) at rest. Upon login callback, session IDs are rotated to eliminate session fixation (EC-A05). State-mutating endpoints enforce `X-CSRF-Token` headers.
- **Cryptographic Audit Log:** Every governance event is serialized using RFC 8785 canonical JSON sorting and chained using SHA-256 (`hash = SHA256(prev_hash + canonical_json)`). Database trigger `tr_audit_no_update_or_delete` prevents post-hoc log tampering.

### Production Hardening Roadmap:
1. Replace single-node SQLite with distributed PostgreSQL with row-level security (RLS) and pg_audit.
2. Integrate hardware security modules (HSM) or KMS-backed asymmetric key pairs for signing audit heads.
3. Deploy an external Envoy/Traefik PEP sidecar filter that invokes GrantGate PDP via gRPC before routing traffic to real model endpoints.

---

## Testing

### Prioritized Behaviors:
1. **Separation of Duties (SG-1 & SG-2):** Verified that requesters cannot approve their own requests under any condition and that dual-slot approval requires distinct principals. Self-approval attempts immediately persist a `SECURITY_TAMPER_ATTEMPT` audit event.
2. **Limits Algebra Invariants (SG-3):** Verified via Hypothesis property-based testing that narrowing is strictly monotonic, meet operations are associative and commutative, and narrowed bounds never exceed requested bounds.
3. **Emergency Revocation (SG-4):** Verified that emergency revocation immediately marks grants as `REVOKED`, halting PEP execution even if local client clocks are manipulated.
4. **Time & Expiry Invariants:** Verified that effective status is evaluated dynamically against server time and that clock rollback cannot resurrect expired or revoked grants.
5. **Complementary Innovations Verification:** Verified that priority scoring, starvation escalation, bottleneck analytics, role assistance, purpose-bound violation detection, and early release endpoints enforce all business and safety rules.

---

## Design System & Accessibility Decisions

- **Color Palette Rationale:** Shifted away from dark "cyberpunk/blue-black" themes toward a warm light beige, sand, and porcelain palette (`#fbf9f4`, `#f4efe6`, `#ffffff`) with terracotta brand accents (`#c2410c`). This elevates GrantGate into an enterprise-grade governance platform that executives, compliance officers, and auditors can comfortably use during audits without visual fatigue.
- **Semantic Badging:** Standardized green for active/approved, amber for narrowed/dormant/caution, rose for rejected/revoked/critical violations, and deep slate for neutral metadata.
- **High-Contrast Text Hierarchy:** Enforced minimum 4.5:1 WCAG contrast ratios across all cards, badges, and code snippets.

---

## ServiceNow Security Incident Response (SIR) Integration & Webhook Adapter

### Architecture & Decisions:
1. **Automated SIR Opening on PDP Violations:** Whenever the Policy Decision Point (PDP) denies an invocation due to security policy breaches (`DENY_PURPOSE_MISMATCH`, `DENY_ACTION_NOT_GRANTED`, `DENY_REVOKED`, `DENY_ACTION_NOT_DELEGATED`, `DENY_NETWORK_DESTINATION_NOT_APPROVED`, `DENY_TAINTED_EXFILTRATION`), `ServiceNowService.auto_open_sir_incident` intercepts the denial.
2. **Deterministic Payload Generation (`sn_si_incident`):** A pure domain function formats the incident into standard ServiceNow Table API schema (`number`, `short_description`, `description`, `severity`, `priority`, `category`, `subcategory`, `state="1"`, `cmdb_ci`, `caller_id`, `work_notes`, `correlation_id`).
3. **Outbound & Inbound Webhooks:** Outbound dispatches are mockable and resilient (Rule 7). An inbound webhook endpoint (`POST /api/secops/servicenow/webhook`) allows external ServiceNow instances to synchronize state updates (`INVESTIGATING`, `CONTAINED`, `RESOLVED`, `CLOSED`) and analyst notes back into GrantGate.
4. **Strict Audit Trail:** Every ServiceNow dispatch and inbound webhook processing writes a cryptographic audit event (`SERVICENOW_SIR_OPENED`, `SERVICENOW_WEBHOOK_PROCESSED`) in the same database transaction (Rule 5).
