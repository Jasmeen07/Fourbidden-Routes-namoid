# GrantGate

**[Powered by NamoID](https://namoid.in)** ·
[NamoID documentation](https://docs.namoid.in) ·
[Challenge catalog](https://challenges.namoid.in)

> Built on the NamoID identity platform for the **NamoID Community Challenges** program.

This repository is a contributor-owned response to the
`responsible-ai-access-gate` problem statement. It was created from the official
[NamoID challenge template](https://github.com/namoidhq/namoid-challenge-template).

This project is an independent community build. It is not an official
NamoID product, security recommendation, or endorsement.

> **Mandatory Governance Notice:**
> *"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*

---

## Community project metadata

- **Challenge ID:** `responsible-ai-access-gate`
- **Contributor:** Jasmeen07
- **Repository URL:** https://github.com/Jasmeen07/Fourbidden-Routes-namoid
- **Live demo:** http://localhost:5173
- **Final commit:** `388e3201d1490b0e7179fcd782dd4b37aeb38898`
- **License:** MIT

---

## NamoID integration

GrantGate uses **NamoID Hosted Auth as the application's sign-in system**:
- **Authentication Flows:** Implemented via standard OpenID Connect (OIDC) authorization code flow with PKCE (`S256`) and single-use state/nonce validation in `backend/app/auth/`.
- **Identity Provider (`backend/app/auth/namoid_provider.py`):** Integrates NamoID Hosted Auth in live environments (`NAMOID_ENV=live`) and spec-faithful mock provider for deterministic automated testing.
- **Session Management:** OIDC sessions use opaque 48-byte cryptographically random tokens stored hashed (SHA-256) at rest. Upon callback, session IDs are rotated (anti-fixation, EC-A05). State-mutating endpoints enforce `X-CSRF-Token` headers.

---

## ⚡ Quickstart (3 Commands)

### 1. Initialize & Seed Database
```bash
py -3.13 scripts/seed_demo.py
```

### 2. Launch Backend API (Port 8000)
```bash
py -3.13 -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

### 3. Launch Frontend Web App (Port 5173)
```bash
cd frontend && npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Verification & Test Suite

### Run All 71 Backend Tests
Includes all unit tests, database trigger guards, property-based tests (Hypothesis), security tests, and the **4 mandatory challenge scenarios**:
```bash
py -3.13 -m pytest backend/tests -v
```

### Verify Metadata Compliance (NamoID Challenge Validator)
```bash
npm run check
```

### Verify 100% Edge Case Coverage (65 / 65)
```bash
py -3.13 scripts/check_ec_coverage.py
```

### Verify Cryptographic Audit Chain
```bash
py -3.13 scripts/gen_sample_history.py
```
Exports byte-identical sample history to `docs/sample_access_history.json` and `docs/sample_access_history.csv`.

---

## 🏛️ Key Security & Architecture Invariants

- **Separation of Duties (SG-1 & SG-2):** Requesters can never review their own requests. Dual-slot reviews require distinct principals. Any self-review attempt logs an immutable `SECURITY_TAMPER_ATTEMPT` audit event.
- **Monotonic Limits Algebra (SG-3):** Reviewers can only tighten bounds or restrict formats/actions ($\text{Narrowed} \subseteq \text{Requested}$). Scope expansion is mathematically rejected.
- **Derived Effective Status:** Grants are dynamically evaluated against server time. Zombie tokens and expired grants are immediately denied at the Policy Enforcement Point (PEP).
- **Emergency Revocation (SG-4):** Break-glass revocation immediately invalidates PEP execution and halts active connections.
- **Append-Only Cryptographic Audit Chain (SG-5):** Every governance event is serialized to canonical JSON (RFC 8785) and chained via SHA-256 (`hash = SHA256(prev_hash + canonical_json)`). Protected against mutation by SQLite database triggers.

---

## 🤖 Advisory AI Track

- **Module 1 (Risk Lens):** Real-time explainable risk scoring (0–100) with factor weight attribution and counterfactual narrowing search that suggests specific parameter adjustments to lower risk.
- **Module 4 (Policy-as-Code Assurance Linter):** Automated static analysis for `config/policy.yaml`, verifying role coverage, detecting orphan roles, and simulating what-if routing projections.

---

## 📂 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── ai/              # Explainable Risk Lens & advisory narrator
│   │   ├── api/             # FastAPI routers (auth, requests, reviews, grants, sim, audit, policy)
│   │   ├── auth/            # Session manager, role resolver, OIDC & mock providers
│   │   ├── db/              # SQLAlchemy models, SQLite WAL engine, 7 triggers
│   │   ├── domain/          # Pure core: limits algebra, SoD, effective status, PDP, hashing
│   │   └── services/        # Request lifecycle, reviews, grants, audit, PEP gateway
│   └── tests/               # 71 tests (unit, property, db triggers, security, API)
├── frontend/                # Vite + React + TypeScript SPA
│   ├── src/
│   │   ├── components/      # SafetyBanner, Navbar, LimitsDiff, RiskLensCard, DecisionDrawer, TraceViewer
│   │   ├── pages/           # Catalog, NewRequest, Requests, Reviews, Grants, Simulator, Audit, Policy
│   │   └── context/         # AuthContext & instant persona switcher
├── config/
│   ├── policy.yaml          # Policy-as-Code configuration
│   ├── resources.seed.yaml  # Governed models, datasets, tools
│   └── users.seed.yaml      # Seed users and role mappings
├── docs/
│   ├── BLUEPRINT.md         # Full specification
│   ├── ARCHITECTURE.md      # Technical architecture specification
│   ├── THREAT_MODEL.md      # Threat model & security analysis
│   ├── DEMO_SCRIPT.md       # 5-minute evaluation walk-through script
│   ├── FIRST_REAL_RESOURCE.md # Production onboarding guide for real datasets
│   ├── sample_access_history.json # Chained sample audit log export
│   └── sample_access_history.csv  # Chained sample audit log CSV
├── scripts/
│   ├── setup.mjs            # Challenge setup script
│   ├── validate.mjs         # NamoID metadata validator
│   ├── check_ec_coverage.py # 65/65 edge case coverage validator
│   ├── seed_demo.py         # Database bootstrap utility
│   ├── gen_sample_history.py # Deterministic audit chain generator
│   └── export_openapi.py    # OpenAPI schema exporter
├── DECISIONS.md             # Architectural & engineering decisions
├── NOTICE.md                # Attribution and independence notice
├── LICENSE                  # MIT License
└── namoid-challenge.json    # Machine-readable submission metadata
```
