"""Tests for FORGE Organizational Hierarchy, AI Agent Delegation, Datalog, and Network Guardrails."""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete
from fastapi.testclient import TestClient
from app.main import create_app
from app.db.engine import init_database, SessionLocal
from app.db.models import User, UserRole, Resource, AccessRequest, Grant, ReviewSlot, AgentEvent, EventDependency
from app.ids import generate_id
from app.domain.datalog import DatalogEngine, Fact, Rule, NegatedFact
from app.domain.provenance import (
    EventNode,
    EventEdge,
    ProvenanceGraph,
    compute_taint_and_secrets,
    evaluate_network_guardrails,
    DEFAULT_APPROVED_DESTINATIONS,
)


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


def setup_test_data(db):
    # Ensure test users and hierarchy
    for sub, name, role, dept, mgr, is_ag, owner, del_perm in [
        ("E001", "CEO Alice", "executive", "Executive", None, False, None, None),
        ("E002", "CTO Bob", "executive", "Engineering", "E001", False, None, None),
        ("E050", "Eng Manager Charlie", "manager", "Engineering", "E002", False, None, None),
        ("E102", "Dev David", "developer", "Engineering", "E050", False, None, None),
        ("AG102", "Eng AI Agent", "agent", "Engineering", None, True, "E102", ["read_file", "read_sample", "query"]),
        ("E003", "CFO Frank", "executive", "Finance", "E001", False, None, None),
        ("E060", "Fin Manager Grace", "manager", "Finance", "E003", False, None, None),
        ("E201", "Fin Analyst Heidi", "analyst", "Finance", "E060", False, None, None),
        ("AG201", "Fin AI Agent", "agent", "Finance", None, True, "E201", ["read_file", "query"]),
        ("R001", "Security Officer Ivan", "risk_reviewer", "Security", None, False, None, None),
        ("E301", "Network Admin Judy", "network_admin", "Network", "E002", False, None, None),
        ("AG301", "Network AI Agent", "agent", "Network", None, True, "E301", ["read_file", "query", "external_send"]),
        ("alice", "Alice Alias", "requester", "Engineering", "E050", False, None, None),
        ("carol", "Carol Alias", "manager", "Engineering", "E002", False, None, None),
    ]:
        u = db.get(User, sub)
        if not u:
            u = User(
                sub=sub,
                display_name=name,
                email=f"{sub}@test.com",
                department=dept,
                manager_sub=mgr,
                is_agent=is_ag,
                owner_sub=owner,
                delegated_permissions=del_perm,
                active=True,
            )
            db.add(u)
            db.add(UserRole(sub=sub, role=role))
        else:
            u.department = dept
            u.manager_sub = mgr
            u.is_agent = is_ag
            u.owner_sub = owner
            u.delegated_permissions = del_perm

    # Ensure test resources
    res = db.get(Resource, "D-claims-synth")
    if not res:
        db.add(Resource(
            id="D-claims-synth",
            name="Synthetic Insurance Claims",
            kind="dataset",
            tier="RESTRICTED_SYNTHETIC",
            department="Finance",
            sensitivity="CRITICAL",
            is_crucial=True,
            owner_sub="E060",
            allowed_actions=[
                {"name": "read_sample", "risk_weight": 2},
                {"name": "read_full", "risk_weight": 5},
                {"name": "export_masked", "risk_weight": 7},
            ],
            active=True,
        ))

    eng_res = db.get(Resource, "engineering.csv")
    if not eng_res:
        db.add(Resource(
            id="engineering.csv",
            name="Engineering Architecture Spec",
            kind="dataset",
            tier="INTERNAL_SYNTHETIC",
            department="Engineering",
            sensitivity="INTERNAL",
            is_crucial=False,
            owner_sub="E050",
            allowed_actions=[
                {"name": "read_file", "risk_weight": 1},
                {"name": "query", "risk_weight": 2},
            ],
            active=True,
        ))

    from sqlalchemy import delete
    ag_reqs = db.execute(select(AccessRequest.id).where(AccessRequest.requester_sub == "AG102")).scalars().all()
    if ag_reqs:
        db.execute(delete(ReviewSlot).where(ReviewSlot.request_id.in_(ag_reqs)))
        db.execute(delete(AccessRequest).where(AccessRequest.id.in_(ag_reqs)))

    db.commit()


def test_hierarchy_tree_api(client):
    """FORGE Hierarchy API returns employees, agents, human ownership, and reporting lines."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        res = client.get("/api/hierarchy")
        assert res.status_code == 200
        data = res.json()
        assert data["tree_root"] == "E001"
        assert "principals" in data
        assert "departments" in data
        assert "Engineering" in data["departments"]
        assert "Finance" in data["departments"]

        # Check AI agent has owner
        ag = next(p for p in data["principals"] if p["id"] == "AG102")
        assert ag["is_agent"] is True
        assert ag["owner_id"] == "E102"
        assert "read_file" in ag["delegated_permissions"]
    finally:
        db.close()


def test_ai_agent_delegation_constraint(client):
    """FORGE §7.3: AI Agent permissions are constrained to delegated subset."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        # Login as AG102
        login_res = client.post("/auth/dev-login", json={"user_id": "AG102"})
        assert login_res.status_code == 200
        csrf = login_res.json()["csrf_token"]

        # 1. Attempt non-delegated action -> Rejected with 403 / DELEGATION_CONTROL_VIOLATION
        bad_req = client.post(
            "/api/requests",
            headers={"X-CSRF-Token": csrf},
            json={
                "resource_id": "engineering.csv",
                "purpose_code": "PROTOTYPE_DEMO",
                "purpose_text": "Agent attempting non-delegated admin write",
                "actions": ["admin_write"],
                "duration_minutes": 30,
                "risk_controls": ["activity_logging"],
            },
        )
        assert bad_req.status_code in [400, 403, 422]

        # 2. Delegated action -> Allowed
        ok_req = client.post(
            "/api/requests",
            headers={"X-CSRF-Token": csrf},
            json={
                "resource_id": "engineering.csv",
                "purpose_code": "PROTOTYPE_DEMO",
                "purpose_text": "Agent performing permitted code query",
                "actions": ["read_sample"],
                "duration_minutes": 30,
                "risk_controls": ["activity_logging", "synthetic_data_only"],
            },
        )
        assert ok_req.status_code == 200
        assert ok_req.json()["status"] == "IN_REVIEW"
    finally:
        db.close()


def test_hierarchy_immediate_superior_routing_vs_crucial_escalation(client):
    """FORGE: Non-crucial same-dept requests routed to immediate superior; crucial data escalated."""
    db = SessionLocal()
    try:
        setup_test_data(db)

        # 1. Non-crucial engineering request by E102 -> only immediate superior E050
        prev1 = client.get("/api/hierarchy/preview-approval?requester_id=E102&resource_id=engineering.csv")
        assert prev1.status_code == 200
        d1 = prev1.json()
        assert d1["is_crucial"] is False
        assert len(d1["steps"]) == 1
        assert d1["steps"][0]["assigned_sub"] == "E050"
        assert d1["steps"][0]["slot_role"] == "manager"

        # 2. Crucial finance data request by E102 -> escalated (E050 manager, E002 CTO executive, E060 owner, R001 security)
        prev2 = client.get("/api/hierarchy/preview-approval?requester_id=E102&resource_id=D-claims-synth")
        assert prev2.status_code == 200
        d2 = prev2.json()
        assert d2["is_crucial"] is True
        assert len(d2["steps"]) >= 3
        roles = [s["slot_role"] for s in d2["steps"]]
        assert "manager" in roles
        assert "executive" in roles
        assert "risk_reviewer" in roles
    finally:
        db.close()


def test_datalog_engine_and_self_approval_denial():
    """FORGE Datalog engine: self-approval prevention and fixed-point evaluation."""
    engine = DatalogEngine()
    # Requester E102
    engine.add_fact("Requester", "req1", "E102")
    engine.add_fact("Approver", "req1", "E102")  # E102 attempting to self-approve
    engine.add_fact("ApproveRequest", "req1")

    # FORGE Rule: Deny(a) :- ApproveRequest(a), Requester(a, p), Approver(a, p)
    engine.add_rule(
        Fact("Deny", ("A",)),
        Fact("ApproveRequest", ("A",)),
        Fact("Requester", ("A", "P")),
        Fact("Approver", ("A", "P")),
    )
    facts = engine.evaluate()
    assert Fact("Deny", ("req1",)) in facts


def test_provenance_taint_propagation_and_network_guardrails(client):
    """FORGE: Dependency graph taint propagation and network team guardrails."""
    db = SessionLocal()
    try:
        setup_test_data(db)

        # Build graph in domain
        now = datetime.now(timezone.utc)
        nodes = {
            "evt_vendor_doc": EventNode(
                id="evt_vendor_doc",
                event_type="message",
                action="receive_input",
                principal_id="AG102",
                label="untrusted_input",
            ),
            "evt_finance_read": EventNode(
                id="evt_finance_read",
                event_type="tool_result",
                action="read_file",
                principal_id="AG102",
                label="sensitive_input",
            ),
            "evt_send": EventNode(
                id="evt_send",
                event_type="external_send",
                action="external_send",
                principal_id="AG102",
                destination="https://attacker.evil.com/exfil",
                label="clean",
            ),
        }
        edges = (
            EventEdge(event_id="evt_send", depends_on_id="evt_vendor_doc"),
            EventEdge(event_id="evt_send", depends_on_id="evt_finance_read"),
        )
        graph = ProvenanceGraph(nodes=nodes, edges=edges)
        labels = compute_taint_and_secrets(graph)

        assert "tainted" in labels["evt_send"]
        assert "has_secret" in labels["evt_send"]

        # Network guardrail evaluation: external destination not approved + tainted secret -> Deny
        allowed, reason, policy = evaluate_network_guardrails(
            action="external_send",
            destination="https://attacker.evil.com/exfil",
            propagated_labels=labels["evt_send"],
        )
        assert allowed is False
        assert "Exfiltration blocked" in reason or "not in the approved allowlist" in reason
    finally:
        db.close()


def test_smart_access_utilization_and_early_release(client):
    """Smart Access Utilization tracking and Requester Early Release."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        req_id = generate_id("req")
        now = datetime.now(timezone.utc)
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="engineering.csv",
            purpose_code="PROTOTYPE_DEMO",
            purpose_text="Evaluation completed early",
            actions=["read_file"],
            duration_minutes=120,
            risk_controls=["activity_logging"],
            status="APPROVED",
            policy_version=1,
            content_hash="mockhash789",
            created_at=now,
        )
        db.add(req)
        db.flush()

        grant_id = generate_id("grant")
        grant = Grant(
            id=grant_id,
            request_id=req_id,
            requester_sub="alice",
            resource_id="engineering.csv",
            purpose_code="PROTOTYPE_DEMO",
            actions=["read_file"],
            activated_at=now,
            expires_at=now + timedelta(hours=2),
            status="ACTIVE",
            invocation_count=0,
            last_used_at=None,
        )
        db.add(grant)
        db.commit()

        login_res = client.post("/auth/dev-login", json={"user_id": "alice"})
        csrf = login_res.json()["csrf_token"]

        # 1. Successful invoke updates utilization
        inv_res = client.post(
            "/api/sim/resources/engineering.csv/invoke",
            headers={"X-CSRF-Token": csrf},
            json={"action": "read_file", "declared_purpose": "PROTOTYPE_DEMO"},
        )
        assert inv_res.status_code == 200
        assert inv_res.json()["decision"]["allow"] is True

        # Check grant utilization info
        g_res = client.get(f"/api/grants/{grant_id}", headers={"X-CSRF-Token": csrf})
        assert g_res.status_code == 200
        g_info = g_res.json()
        assert g_info["invocation_count"] >= 1
        assert g_info["last_used_at"] is not None

        # 2. Requester early release
        rel_res = client.post(f"/api/grants/{grant_id}/release-early", headers={"X-CSRF-Token": csrf})
        assert rel_res.status_code == 200
        assert rel_res.json()["status"] == "REVOKED"
        assert rel_res.json()["released_early"] is True
    finally:
        db.close()


def test_sim_invoke_with_network_guardrails(client):
    """PEP Simulator invocation with destination allowlist and violation detection."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        now = datetime.now(timezone.utc)
        req_id = generate_id("req")
        grant_id = generate_id("grant")
        req = AccessRequest(
            id=req_id,
            requester_sub="E301",
            resource_id="engineering.csv",
            purpose_code="PROTOTYPE_DEMO",
            purpose_text="Network operations",
            actions=["query"],
            duration_minutes=60,
            risk_controls=["activity_logging"],
            status="APPROVED",
            policy_version=1,
            content_hash="mockhash456",
            created_at=now,
        )
        db.add(req)
        db.flush()
        grant = Grant(
            id=grant_id,
            request_id=req_id,
            requester_sub="E301",
            resource_id="engineering.csv",
            purpose_code="PROTOTYPE_DEMO",
            actions=["query"],
            activated_at=now,
            expires_at=now + timedelta(hours=2),
            status="ACTIVE",
            invocation_count=0,
            last_used_at=None,
        )
        db.add(grant)
        db.commit()

        login_res = client.post("/auth/dev-login", json={"user_id": "E301"})
        csrf = login_res.json()["csrf_token"]

        # 1. Allowed invocation
        res_ok = client.post(
            "/api/sim/invoke",
            headers={"X-CSRF-Token": csrf},
            json={
                "action": "query",
                "declared_purpose": "PROTOTYPE_DEMO",
                "grant_id": grant_id,
                "resource_id": "engineering.csv",
            },
        )
        assert res_ok.status_code == 200
        data_ok = res_ok.json()
        assert data_ok["decision"] == "ALLOW"

        # 2. Purpose mismatch -> Deny + violation flag
        res_bad = client.post(
            "/api/sim/invoke",
            headers={"X-CSRF-Token": csrf},
            json={
                "action": "query",
                "declared_purpose": "UNAUTHORIZED_SECONDARY_SALE",
                "grant_id": grant_id,
                "resource_id": "engineering.csv",
            },
        )
        assert res_bad.status_code == 200
        data_bad = res_bad.json()
        assert data_bad["decision"] == "DENY"
        assert data_bad["violation"] is True
    finally:
        db.close()
