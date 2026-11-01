"""Tests for Role-Based My Access & Security Dashboard (Requirement 4).

Verifies role-based access control, privacy isolation (employees cannot see
org-wide hierarchy), personal access tracking, and preservation of the mandatory
3-stage approval workflow upon renewal.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.main import create_app
from app.db.engine import SessionLocal, init_database
from app.db.models import User, UserRole, Resource, AccessRequest, Grant, ReviewSlot
from app.ids import generate_id
from app.services.requests import RequestsService


@pytest.fixture
def test_client():
    init_database()
    app = create_app()
    with TestClient(app) as client:
        yield client


def setup_role_test_environment(db: Session):
    now = datetime.now(timezone.utc)

    # 1. Employee / Requester: Alice
    alice = db.get(User, "alice")
    if not alice:
        alice = User(sub="alice", display_name="Alice Chen", email="alice@test.com", manager_sub="carol", department="Engineering", active=True)
        db.add(alice)
        db.add(UserRole(sub="alice", role="requester"))

    # 2. Manager: Carol
    carol = db.get(User, "carol")
    if not carol:
        carol = User(sub="carol", display_name="Carol Danvers", email="carol@test.com", manager_sub="fiona", department="Engineering", active=True)
        db.add(carol)
        db.add(UserRole(sub="carol", role="manager"))

    # 3. Risk Reviewer: Elena
    elena = db.get(User, "elena")
    if not elena:
        elena = User(sub="elena", display_name="Elena Rostova", email="elena@test.com", department="Security", active=True)
        db.add(elena)
        db.add(UserRole(sub="elena", role="risk_reviewer"))

    # 4. Resource Owner: David
    david = db.get(User, "david")
    if not david:
        david = User(sub="david", display_name="David Miller", email="david@test.com", department="Finance", active=True)
        db.add(david)
        db.add(UserRole(sub="david", role="resource_owner"))

    # 5. Administrator: Fiona
    fiona = db.get(User, "fiona")
    if not fiona:
        fiona = User(sub="fiona", display_name="Fiona Gallagher", email="fiona@test.com", department="Executive", active=True)
        db.add(fiona)
        db.add(UserRole(sub="fiona", role="admin"))

    # Governed Resource owned by David
    res = db.get(Resource, "finance.csv")
    if not res:
        res = Resource(
            id="finance.csv",
            name="Confidential Financial Dataset",
            kind="dataset",
            tier="RESTRICTED_SYNTHETIC",
            department="Finance",
            sensitivity="CRITICAL",
            is_crucial=True,
            owner_sub="david",
            allowed_actions=[{"name": "read_sample", "risk_weight": 2}, {"name": "read_full", "risk_weight": 5}],
            active=True,
        )
        db.add(res)
    else:
        res.owner_sub = "david"

    req = db.get(AccessRequest, "req_test_renew_seed")
    if not req:
        req = AccessRequest(
            id="req_test_renew_seed",
            requester_sub="alice",
            resource_id="finance.csv",
            purpose_code="PROTOTYPE_DEMO",
            purpose_text="Quarterly predictive model fine-tuning and safety validation.",
            actions=["read_sample"],
            duration_minutes=1440,
            status="APPROVED",
            risk_controls=["activity_logging", "synthetic_data_only", "isolated_workspace"],
            created_at=now - timedelta(hours=2),
            content_hash="mock_hash_seed",
        )
        db.add(req)
        db.flush()

    # Active grant for Alice
    grant_id = "grant_test_alice_renew"
    grant = db.get(Grant, grant_id)
    if not grant:
        grant = Grant(
            id=grant_id,
            request_id="req_test_renew_seed",
            requester_sub="alice",
            resource_id="finance.csv",
            purpose_code="PROTOTYPE_DEMO",
            actions=["read_sample"],
            activated_at=now - timedelta(hours=1),
            expires_at=now + timedelta(hours=23),
            status="ACTIVE",
            invocation_count=0,
            last_used_at=None,
        )
        db.add(grant)

    # Clean up any leftover open requests for alice on finance.csv from previous runs
    leftovers = db.execute(
        select(AccessRequest).where(
            and_(
                AccessRequest.requester_sub == "alice",
                AccessRequest.resource_id == "finance.csv",
                AccessRequest.status.in_(["IN_REVIEW", "BLOCKED"]),
            )
        )
    ).scalars().all()
    for lr in leftovers:
        db.delete(lr)
    db.commit()


@pytest.mark.ec("EC-RBAC-01")
def test_employee_my_access_view_isolation(test_client):
    """Employee only sees their own active grants, requests, alerts, and cannot access org hierarchy."""
    db = SessionLocal()
    try:
        setup_role_test_environment(db)
        login = test_client.post("/auth/dev-login", json={"user_id": "alice"})
        assert login.status_code == 200

        res = test_client.get("/api/my-access")
        assert res.status_code == 200
        data = res.json()

        profile = data["user_profile"]
        assert profile["sub"] == "alice"
        assert profile["is_admin"] is False
        assert profile["is_manager"] is False

        # Employee view is populated
        emp = data["employee_view"]
        assert len(emp["my_active_access"]) >= 1
        assert emp["my_active_access"][0]["resource_id"] == "finance.csv"
        assert "smart_recommendations" in emp

        # Privileged views are omitted for regular employee
        assert data["manager_view"] is None
        assert data["admin_view"] is None

        # Hierarchy endpoint returns 403 Forbidden for employee (Privacy Isolation)
        hier_res = test_client.get("/api/hierarchy")
        assert hier_res.status_code == 403
        detail = hier_res.json().get("detail", {})
        code = detail.get("code") if isinstance(detail, dict) else hier_res.json().get("code")
        assert code == "DENY_FORBIDDEN"
    finally:
        db.close()


@pytest.mark.ec("EC-RBAC-02")
def test_manager_team_access_oversight(test_client):
    """Manager sees team requests, pending approvals, and direct reports."""
    db = SessionLocal()
    try:
        setup_role_test_environment(db)
        login = test_client.post("/auth/dev-login", json={"user_id": "carol"})
        assert login.status_code == 200

        res = test_client.get("/api/my-access")
        assert res.status_code == 200
        data = res.json()

        profile = data["user_profile"]
        assert profile["is_manager"] is True

        mgr = data["manager_view"]
        assert mgr is not None
        assert "team_members" in mgr
        assert "team_requests" in mgr
    finally:
        db.close()


@pytest.mark.ec("EC-RBAC-03")
def test_resource_owner_and_risk_reviewer_views(test_client):
    """Resource Owner monitors owned resources and Risk Reviewer evaluates risk-bound requests."""
    db = SessionLocal()
    try:
        setup_role_test_environment(db)

        # 1. Resource Owner (David)
        login_ro = test_client.post("/auth/dev-login", json={"user_id": "david"})
        assert login_ro.status_code == 200
        ro_data = test_client.get("/api/my-access").json()
        assert ro_data["user_profile"]["is_resource_owner"] is True
        assert ro_data["resource_owner_view"] is not None
        assert any(r["id"] == "finance.csv" for r in ro_data["resource_owner_view"]["owned_resources"])

        # 2. Risk Reviewer (Elena)
        login_risk = test_client.post("/auth/dev-login", json={"user_id": "elena"})
        assert login_risk.status_code == 200
        risk_data = test_client.get("/api/my-access").json()
        assert risk_data["user_profile"]["is_risk_reviewer"] is True
        assert risk_data["risk_reviewer_view"] is not None
        assert "suspicious_access_alerts" in risk_data["risk_reviewer_view"]
    finally:
        db.close()


@pytest.mark.ec("EC-RBAC-04")
def test_administrator_retains_full_hierarchy_and_agents(test_client):
    """Administrator retains full organization hierarchy tree and AI agent governance."""
    db = SessionLocal()
    try:
        setup_role_test_environment(db)
        login = test_client.post("/auth/dev-login", json={"user_id": "fiona"})
        assert login.status_code == 200

        res = test_client.get("/api/my-access")
        assert res.status_code == 200
        data = res.json()

        assert data["user_profile"]["is_admin"] is True
        admin = data["admin_view"]
        assert admin is not None
        assert "hierarchy_tree" in admin
        assert "principals" in admin["hierarchy_tree"]

        # Hierarchy endpoint allows administrator
        hier_res = test_client.get("/api/hierarchy")
        assert hier_res.status_code == 200
        assert hier_res.json()["tree_root"] == "E001"
    finally:
        db.close()


@pytest.mark.ec("EC-RBAC-05")
def test_access_renewal_preserves_mandatory_three_stage_workflow(test_client):
    """Access renewal triggers the mandatory 3-party workflow: Manager -> Risk Reviewer -> Resource Owner."""
    db = SessionLocal()
    try:
        setup_role_test_environment(db)
        login = test_client.post("/auth/dev-login", json={"user_id": "alice"})
        csrf = login.json()["csrf_token"]

        renew_payload = {
            "grant_id": "grant_test_alice_renew",
            "additional_minutes": 1440,
            "justification": "Continuation of safety alignment research and model validation.",
        }

        res = test_client.post(
            "/api/my-access/renew",
            json=renew_payload,
            headers={"X-CSRF-Token": csrf},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "SUBMITTED"
        req_id = data["request_id"]

        # Verify in DB: Request has all three mandatory review slots
        req = db.get(AccessRequest, req_id)
        assert req is not None
        assert req.status == "IN_REVIEW"
        assert req.extends_grant_id == "grant_test_alice_renew"

        slot_roles = {s.slot_role for s in req.slots}
        assert "manager" in slot_roles
        assert "risk_reviewer" in slot_roles
        assert "resource_owner" in slot_roles
    finally:
        db.close()
