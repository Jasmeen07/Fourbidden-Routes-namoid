"""Tests for the Five Complementary Innovations (Updated Proposal)."""
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import create_app
from app.db.engine import init_database, SessionLocal
from app.db.models import User, UserRole, Resource, AccessRequest, Grant, ReviewSlot
from app.ids import generate_id


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


def setup_test_data(db):
    now = datetime.now(timezone.utc)
    # Ensure test users
    for sub, name, role in [
        ("alice", "Alice Requester", "requester"),
        ("carol", "Carol Manager", "manager"),
        ("david", "David Owner", "resource_owner"),
        ("elena", "Elena Risk", "risk_reviewer"),
    ]:
        u = db.get(User, sub)
        if not u:
            db.add(User(sub=sub, display_name=name, email=f"{sub}@test.com", active=True))
            db.add(UserRole(sub=sub, role=role))
    
    # Ensure test resource
    res = db.get(Resource, "D-claims-synth")
    if not res:
        db.add(Resource(
            id="D-claims-synth",
            name="Synthetic Insurance Claims",
            kind="dataset",
            tier="RESTRICTED_SYNTHETIC",
            owner_sub="david",
            allowed_actions=[
                {"name": "read_sample", "risk_weight": 2},
                {"name": "read_full", "risk_weight": 5},
                {"name": "export_masked", "risk_weight": 7},
            ],
            active=True,
        ))
    db.commit()


def test_innovation_priority_and_bottlenecks(client):
    """Innovation 2: Urgency Priority and Bottleneck Detection."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        
        # Create a pending request
        req_id = generate_id("req")
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="D-claims-synth",
            purpose_code="BIAS_AUDIT",
            purpose_text="Fairness evaluation across demographic claims subsets",
            actions=["read_sample", "read_full"],
            duration_minutes=30,  # Short turnaround deadline -> high priority
            risk_controls=["activity_logging", "synthetic_data_only"],
            status="IN_REVIEW",
            policy_version=1,
            content_hash="mockhash123",
            created_at=datetime.now(timezone.utc),
        )
        db.add(req)
        db.flush()
        
        # Add 3 slots
        for s_role, s_sub in [("manager", "carol"), ("risk_reviewer", "elena"), ("resource_owner", "david")]:
            db.add(ReviewSlot(
                id=generate_id("slot"),
                request_id=req_id,
                slot_role=s_role,
                assigned_sub=s_sub,
                status="PENDING",
            ))
        db.commit()

        # Login as carol (manager)
        login_res = client.post("/auth/dev-login", json={"user_id": "carol"})
        assert login_res.status_code == 200
        csrf = login_res.json()["csrf_token"]

        # Check requests list returns priority metrics
        res = client.get("/api/requests?view=visible", headers={"X-CSRF-Token": csrf})
        assert res.status_code == 200
        reqs = res.json()
        target = next((r for r in reqs if r["id"] == req_id), None)
        assert target is not None
        assert "priority" in target
        assert target["priority"]["priority_band"] in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
        assert len(target["priority"]["priority_reasons"]) > 0

        # Check bottleneck analytics endpoint
        b_res = client.get("/api/requests/analytics/bottlenecks", headers={"X-CSRF-Token": csrf})
        assert b_res.status_code == 200
        b_data = b_res.json()
        assert "stages" in b_data
        assert any(s["stage"] == "risk_reviewer" for s in b_data["stages"])
    finally:
        db.close()


def test_innovation_approval_assistance(client):
    """Innovation 3: Role-tailored Approval Assistance & Previous Lineage."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        req_id = generate_id("req")
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="D-claims-synth",
            purpose_code="BIAS_AUDIT",
            purpose_text="Fairness evaluation on synthetic dataset",
            actions=["read_sample", "read_full"],
            duration_minutes=60,
            risk_controls=["activity_logging", "synthetic_data_only"],
            status="IN_REVIEW",
            policy_version=1,
            content_hash="mockhash456",
            created_at=datetime.now(timezone.utc),
        )
        db.add(req)
        db.flush()
        db.add(ReviewSlot(
            id=generate_id("slot"),
            request_id=req_id,
            slot_role="manager",
            assigned_sub="carol",
            status="PENDING",
        ))
        db.commit()

        login_res = client.post("/auth/dev-login", json={"user_id": "carol"})
        csrf = login_res.json()["csrf_token"]

        res = client.get(f"/api/requests/{req_id}/assistance", headers={"X-CSRF-Token": csrf})
        assert res.status_code == 200
        data = res.json()
        assert "guidance" in data
        assert "manager" in data["guidance"]
        assert "risk_reviewer" in data["guidance"]
        assert "resource_owner" in data["guidance"]
        assert "risk_score" in data
        assert "priority" in data
    finally:
        db.close()


def test_innovation_utilization_and_early_release(client):
    """Innovation 5: Smart Access Utilization tracking and Requester Early Release."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        req_id = generate_id("req")
        now = datetime.now(timezone.utc)
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="D-claims-synth",
            purpose_code="BIAS_AUDIT",
            purpose_text="Evaluation completed early",
            actions=["read_sample"],
            duration_minutes=120,
            risk_controls=["activity_logging", "synthetic_data_only"],
            status="APPROVED",
            policy_version=1,
            content_hash="mockhash789",
            created_at=now,
        )
        db.add(req)
        db.flush()

        grant_id = generate_id("grant")
        from datetime import timedelta
        grant = Grant(
            id=grant_id,
            request_id=req_id,
            requester_sub="alice",
            resource_id="D-claims-synth",
            purpose_code="BIAS_AUDIT",
            actions=["read_sample"],
            activated_at=now,
            expires_at=now + timedelta(hours=2),
            status="ACTIVE",
            invocation_count=0,
            last_used_at=None,
        )
        db.add(grant)
        db.commit()

        # Login as alice
        login_res = client.post("/auth/dev-login", json={"user_id": "alice"})
        csrf = login_res.json()["csrf_token"]

        # 1. Successful invoke updates utilization
        inv_res = client.post(
            "/api/sim/resources/D-claims-synth/invoke",
            headers={"X-CSRF-Token": csrf},
            json={"action": "read_sample", "declared_purpose": "BIAS_AUDIT"},
        )
        assert inv_res.status_code == 200
        assert inv_res.json()["decision"]["allow"] is True

        # Check grant utilization info
        g_res = client.get(f"/api/grants/{grant_id}", headers={"X-CSRF-Token": csrf})
        assert g_res.status_code == 200
        g_info = g_res.json()
        assert g_info["invocation_count"] >= 1
        assert g_info["last_used_at"] is not None
        assert g_info["utilization_status"] == "ACTIVE_UTILIZING"

        # 2. Requester early release
        rel_res = client.post(f"/api/grants/{grant_id}/release-early", headers={"X-CSRF-Token": csrf})
        assert rel_res.status_code == 200
        assert rel_res.json()["status"] == "REVOKED"
        assert rel_res.json()["released_early"] is True
    finally:
        db.close()


def test_innovation_sim_invoke_and_trace(client):
    """Innovation 4: PEP Simulator invoke endpoint with structured trace and violation detection."""
    db = SessionLocal()
    try:
        setup_test_data(db)
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        req_id = generate_id("req")
        grant_id = generate_id("grant")
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="D-claims-synth",
            purpose_code="BIAS_AUDIT",
            purpose_text="Fairness evaluation",
            actions=["read_sample"],
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
            requester_sub="alice",
            resource_id="D-claims-synth",
            purpose_code="BIAS_AUDIT",
            actions=["read_sample"],
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

        # 1. Successful simulation invoke
        res_ok = client.post(
            "/api/sim/invoke",
            headers={"X-CSRF-Token": csrf},
            json={
                "action": "read_sample",
                "declared_purpose": "BIAS_AUDIT",
                "grant_id": grant_id,
                "resource_id": "D-claims-synth",
            },
        )
        assert res_ok.status_code == 200
        data_ok = res_ok.json()
        assert data_ok["decision"] == "ALLOW"
        assert "decision_trace" in data_ok
        assert len(data_ok["decision_trace"]["steps"]) > 0

        # 2. Purpose mismatch simulation invoke (Innovation 4)
        res_bad = client.post(
            "/api/sim/invoke",
            headers={"X-CSRF-Token": csrf},
            json={
                "action": "read_sample",
                "declared_purpose": "UNAUTHORIZED_SECONDARY_SALE",
                "grant_id": grant_id,
                "resource_id": "D-claims-synth",
            },
        )
        assert res_bad.status_code == 200
        data_bad = res_bad.json()
        assert data_bad["decision"] == "DENY"
        assert data_bad["violation"] is True

        # Check violation stream returns the violation
        v_res = client.get("/api/sim/violations", headers={"X-CSRF-Token": csrf})
        assert v_res.status_code == 200
        v_list = v_res.json()
        assert len(v_list) > 0
        assert any(v["declared_purpose"] == "UNAUTHORIZED_SECONDARY_SALE" for v in v_list)
    finally:
        db.close()

