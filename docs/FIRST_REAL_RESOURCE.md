# First Real Resource Onboarding Recommendation

> **Mandatory Governance Notice:**
> *"Approval records an accountable decision under stated controls. It does not make use safe. Residual risks remain."*

---

## 1. Executive Summary & Selection

To transition GrantGate from synthetic sandbox enforcement to production enterprise infrastructure, we recommend onboarding the following candidate as the **First Real Resource**:

**Candidate Resource:** `analytics-customer-churn-dataset` (Read-Only Customer Feature Store)  
**Resource Type:** `DATASET` (Structured Analytics View via Model Context Protocol / PostgreSQL / Snowflake)  
**Criticality Classification:** `TIER_2_SENSITIVE`  
**Data Sensitivities:** Pseudonymized user identifiers, feature tensors, subscription histories, usage metrics.

### Why This Resource First?
1. **High Business Impact, Controlled Blast Radius:** ML engineers require constant access to churn features for model development, yet datasets contain commercially sensitive behavioral metrics.
2. **Deterministic Limit Enforcement:** The limits algebra defined in GrantGate (`max_records`, `max_rps`, `ip_allowlist`, `allowed_formats`) maps directly to standard SQL query filters (`LIMIT n`), connection throttling, and egress IP restrictions.
3. **Read-Only Invariant:** Eliminates data corruption risks during initial deployment.

---

## 2. Technical Architecture & Integration Pattern

The real resource integrates with GrantGate via an **MCP (Model Context Protocol) Gateway / Reverse Proxy PEP**:

```
[ Requester Client / AI Agent ]
             │
             │ 1. Invocation Request + Grant ID
             ▼
[ GrantGate PEP Middleware / Reverse Proxy ]
             │
             │ 2. Evaluate PDP (GET /api/sim/invoke or in-process verification)
             │    - Active status & valid time window
             │    - Subject identity & resource binding
             │    - Declared purpose matches grant purpose
             │    - Enforce Max Records & Rate Limit (RPS)
             │
             ├──[ DENY ]──► 403 Forbidden with RFC 9457 Problem Details
             │
             └──[ ALLOW ]──► Inject Dynamic Database Credential / Short-Lived JWT
                                       │
                                       ▼
                       [ Upstream MCP Server / Analytics View ]
                                       │
                                       │ 3. Execute bounded SQL:
                                       │    SELECT user_id, tenor, churn_score
                                       │    FROM customer_features
                                       │    LIMIT :max_records
                                       ▼
                       [ Returns Data with Governance Header ]
```

---

## 3. Policy-as-Code Configuration

Add the resource definition to `config/resources.seed.yaml`:

```yaml
resources:
  - id: analytics-customer-churn-dataset
    name: "Customer Churn Feature Store (Read-Only)"
    type: "DATASET"
    tier: "TIER_2_SENSITIVE"
    description: "Pseudonymized customer feature vectors for churn prediction and retention modeling."
    allowed_actions:
      - "query"
      - "export"
    max_duration_hours: 48
    required_controls:
      - "data_residency"
      - "audit_logging"
      - "dlp_enabled"
    risk_score: 55
    is_active: true
```

And configure the review slot routing in `config/policy.yaml`:

```yaml
routing_rules:
  - tier: "TIER_2_SENSITIVE"
    slots:
      - slot_index: 0
        role: "DATA_GOVERNANCE"
        description: "Validates declared purpose and verifies data minimization."
      - slot_index: 1
        role: "SECURITY_ADMIN"
        description: "Validates client IP allowlist and network isolation."
```

---

## 4. Step-by-Step Production Onboarding Runbook

### Step 1: Register Upstream Data View
Configure a read-only database role or MCP resource definition with maximum row bounds:
```sql
CREATE ROLE grantgate_ro_reader WITH LOGIN PASSWORD '...';
GRANT SELECT ON analytics.customer_churn_features TO grantgate_ro_reader;
-- Row-level security: enforce mandatory tenant isolation
ALTER TABLE analytics.customer_churn_features ENABLE ROW LEVEL SECURITY;
```

### Step 2: Deploy GrantGate PEP Middleware
Mount the GrantGate FastAPI PEP hook in the upstream API gateway (Kong / Envoy / Traefik / FastAPI):
```python
from fastapi import Request, HTTPException, Depends
from app.services.gateway import PepGatewayService

async def enforce_grantgate_pep(request: Request, grant_id: str):
    client_ip = request.client.host
    action = request.headers.get("X-Declared-Action", "query")
    purpose = request.headers.get("X-Declared-Purpose", "")
    
    trace = PepGatewayService.evaluate_invocation(
        db=request.state.db,
        grant_id=grant_id,
        action=action,
        declared_purpose=purpose,
        client_ip=client_ip,
        resource_id="analytics-customer-churn-dataset"
    )
    if trace["decision"] != "ALLOW":
        raise HTTPException(status_code=403, detail=trace)
```

### Step 3: Implement Break-Glass Emergency Revocation
Ensure that when a Security Administrator or Executive clicks **"Emergency Revocation"** in GrantGate:
1. GrantGate transitions grant to `REVOKED` in SQLite under write transaction.
2. The PEP cache invalidator emits a Redis/Webhook pub-sub message:
   ```json
   {
     "event": "GRANT_REVOKED",
     "grant_id": "grant_xyz",
     "is_emergency": true
   }
   ```
3. Active WebSocket / HTTP connections bound to `grant_id` are instantly severed with zero grace period.

---

## 5. Verification & Testing Criteria

Before opening the resource to general developer access:
1. **Self-Approval Prevention:** Verify requester cannot approve any slot on this resource.
2. **Duration Cap:** Verify requests exceeding 48 hours are rejected at schema validation.
3. **Emergency Revocation:** Trigger emergency revocation during an active query and verify instantaneous connection closure.
4. **Audit Cryptography:** Verify query metadata and access timestamps are permanently hashed into `audit_events`.
