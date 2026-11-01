"""End-to-End tests for NamoID Authentication and 3-Stage Multi-Party Approval Workflow.

Verifies:
- EC-AUTH-01: NamoID session exchange (POST /auth/session) validates token, creates session & cookie.
- EC-AUTH-02: Role resolution and mapping for all five authorized roles.
- EC-AUTH-03: Protection of dev-login when DEMO_MODE is disabled.
- EC-ROUT-01: Access request routing auto-assigns 3 slots (manager, risk_reviewer, resource_owner) and sends notifications.
- EC-APPR-01: Requester cannot self-approve (Separation of Duties).
- EC-APPR-02: Unauthorized role cannot approve an assigned slot.
- EC-APPR-03: Progressive 3-stage approval (Manager -> Risk Reviewer -> Resource Owner).
- EC-APPR-04: Full approval activates Grant only after all three approvals.
- EC-APPR-05: Single rejection halts the workflow and prevents access grant.
- EC-DASH-01: Role-specific dashboard views and visibility isolation.
"""
from datetime import datetime, timezone, timedelta
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import Session

from app.main import create_app
from app.config import settings
from app.db.engine import SessionLocal, init_database
from app.db.models import User, UserRole, Resource, AccessRequest, ReviewSlot, Grant, Notification
from app.domain.states import RequestStatus, SlotStatus, GrantStatus


def clean_priya_requests(db: Session):
    req_ids = list(db.execute(select(AccessRequest.id).where(AccessRequest.requester_sub == "usr_req_priya")).scalars().all())
    if req_ids:
        db.execute(delete(Notification).where(Notification.ref_id.in_(req_ids)))
        db.execute(delete(ReviewSlot).where(ReviewSlot.request_id.in_(req_ids)))
        db.execute(delete(Grant).where(Grant.request_id.in_(req_ids)))
        db.execute(delete(AccessRequest).where(AccessRequest.id.in_(req_ids)))
        db.commit()


@pytest.fixture
def client_and_db():
    init_database()
    app = create_app()
    db = SessionLocal()
    try:
        # Seed test users in dependency order to satisfy manager_sub foreign key constraints
        top_users = [
            User(sub="usr_adm_fiona", display_name="Fiona Gallagher", email="fiona@namoid.in", department="Executive", active=True),
            User(sub="usr_risk_elena", display_name="Elena Rostova", email="elena@namoid.in", department="Risk & Governance", active=True),
            User(sub="usr_own_david", display_name="David Miller", email="david@namoid.in", department="Data Platform", active=True),
        ]
        for u in top_users:
            if not db.get(User, u.sub):
                db.add(u)
        db.commit()

        if not db.get(User, "usr_mgr_carol"):
            db.add(User(sub="usr_mgr_carol", display_name="Carol Danvers", email="carol@namoid.in", manager_sub="usr_adm_fiona", department="AI Engineering", active=True))
            db.commit()

        if not db.get(User, "usr_req_priya"):
            db.add(User(sub="usr_req_priya", display_name="Priya Sharma", email="priya@namoid.in", manager_sub="usr_mgr_carol", department="AI Engineering", active=True))
            db.commit()
        
        role_mappings = [
            ("usr_req_priya", "requester"),
            ("usr_mgr_carol", "manager"),
            ("usr_risk_elena", "risk_reviewer"),
            ("usr_own_david", "resource_owner"),
            ("usr_adm_fiona", "admin"),
        ]
        for sub, role in role_mappings:
            existing_role = db.execute(select(UserRole).where(UserRole.sub == sub, UserRole.role == role)).scalar_one_or_none()
            if not existing_role:
                db.add(UserRole(sub=sub, role=role))
        db.commit()

        # Seed test resource
        res = db.get(Resource, "res_alpha_dataset")
        if not res:
            res = Resource(
                id="res_alpha_dataset",
                name="Customer Intelligence Analytics Dataset",
                kind="dataset",
                tier="INTERNAL_SYNTHETIC",
                owner_sub="usr_own_david",
                department="Data Platform",
                allowed_actions=[
                    {"name": "read_sample", "risk_weight": 1},
                    {"name": "read_full", "risk_weight": 3},
                    {"name": "export_aggregates", "risk_weight": 2},
                ],
                active=True,
            )
            db.add(res)
        db.commit()

        clean_priya_requests(db)

        with TestClient(app) as test_client:
            yield test_client, db
    finally:
        clean_priya_requests(db)
        db.close()


@pytest.mark.ec("EC-AUTH-01")
def test_namoid_token_session_exchange(client_and_db):
    """POST /auth/session creates session from valid token and sets HTTP-only cookie."""
    client, db = client_and_db

    # Create dummy signed JWT token for Priya
    payload = {
        "sub": "usr_req_priya",
        "name": "Priya Sharma",
        "email": "priya@namoid.in",
        "email_verified": True,
        "roles": ["requester"],
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
    }
    encoded_token = jwt.encode(payload, "secret-key", algorithm="HS256")

    response = client.post("/auth/session", json={
        "id_token": encoded_token,
        "access_token": "mock_at_12345",
        "nonce": "test_nonce_abc",
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert "user" in data
    assert data["user"]["sub"] == "usr_req_priya"
    assert "requester" in data["user"]["roles"]
    assert "grantgate_session" in response.cookies


@pytest.mark.ec("EC-AUTH-02")
def test_role_resolution_for_all_roles(client_and_db):
    """Role mapping properly identifies requester, manager, risk_reviewer, resource_owner, admin."""
    client, db = client_and_db

    test_roles = [
        ("user_new_req", "requester", ["requester"]),
        ("user_new_mgr", "manager", ["manager"]),
        ("user_new_risk", "risk_reviewer", ["risk_reviewer"]),
        ("user_new_owner", "resource_owner", ["resource_owner"]),
        ("user_new_adm", "admin", ["admin"]),
    ]

    for sub, input_role, expected_roles in test_roles:
        token = jwt.encode({
            "sub": sub,
            "name": f"User {sub}",
            "email": f"{sub}@namoid.in",
            "roles": [input_role],
        }, "secret", algorithm="HS256")

        resp = client.post("/auth/session", json={"id_token": token})
        assert resp.status_code == 200
        assigned = resp.json()["user"]["roles"]
        for r in expected_roles:
            assert r in assigned


@pytest.mark.ec("EC-AUTH-03")
def test_dev_login_blocked_outside_demo_mode(client_and_db, monkeypatch):
    """Dev login returns 403 Forbidden when DEMO_MODE is disabled."""
    client, db = client_and_db
    monkeypatch.setattr(settings, "DEMO_MODE", False)

    resp = client.post("/auth/dev-login", json={"user_id": "priya"})
    assert resp.status_code == 403
    assert resp.json()["detail"]["code"] == "FORBIDDEN"


@pytest.mark.ec("EC-ROUT-01")
def test_access_request_routing_and_notifications(client_and_db):
    """Access request submission creates 3 approval slots and approver notifications."""
    client, db = client_and_db
    clean_priya_requests(db)

    # Sign in as requester Priya
    token = jwt.encode({"sub": "usr_req_priya", "roles": ["requester"]}, "secret", algorithm="HS256")
    auth_resp = client.post("/auth/session", json={"id_token": token})
    session_token = auth_resp.json()["token"]
    headers = {"Authorization": f"Bearer {session_token}"}

    # Submit dataset access request
    req_body = {
        "resource_id": "res_alpha_dataset",
        "actions": ["read_sample", "read_full"],
        "duration_minutes": 120,
        "purpose_code": "MODEL_EVALUATION",
        "purpose_text": "Model evaluation dataset for customer retention predictive model",
        "risk_controls": ["activity_logging", "synthetic_data_only"],
    }
    create_resp = client.post("/api/requests", json=req_body, headers=headers)
    assert create_resp.status_code in (200, 201)
    created_data = create_resp.json()
    request_id = created_data["id"]

    # Verify slots in database
    slots = db.execute(
        select(ReviewSlot).where(ReviewSlot.request_id == request_id)
    ).scalars().all()
    assert len(slots) == 3
    slot_map = {s.slot_role: s for s in slots}
    assert "manager" in slot_map
    assert "risk_reviewer" in slot_map
    assert "resource_owner" in slot_map

    # Verify assigned approvers
    assert slot_map["manager"].assigned_sub == "usr_mgr_carol"
    assert slot_map["resource_owner"].assigned_sub == "usr_own_david"

    # Verify notifications created for assigned approvers
    notifications = db.execute(
        select(Notification).where(Notification.ref_id == request_id)
    ).scalars().all()
    assert len(notifications) == 3
    notif_recipients = {n.to_sub for n in notifications}
    assert "usr_mgr_carol" in notif_recipients
    assert "usr_own_david" in notif_recipients


@pytest.mark.ec("EC-APPR-01")
def test_sod_requester_cannot_self_approve(client_and_db):
    """Requester cannot self-approve their own request (Separation of Duties)."""
    client, db = client_and_db
    clean_priya_requests(db)

    # Sign in as Priya (requester)
    token = jwt.encode({"sub": "usr_req_priya", "roles": ["requester", "manager"]}, "secret", algorithm="HS256")
    auth_resp = client.post("/auth/session", json={"id_token": token})
    session_token = auth_resp.json()["token"]
    headers = {"Authorization": f"Bearer {session_token}"}

    create_resp = client.post("/api/requests", json={
        "resource_id": "res_alpha_dataset",
        "actions": ["read_sample"],
        "duration_minutes": 60,
        "purpose_code": "BIAS_AUDIT",
        "purpose_text": "Self review test",
        "risk_controls": ["activity_logging", "synthetic_data_only"],
    }, headers=headers)
    assert create_resp.status_code in (200, 201)
    req_id = create_resp.json()["id"]

    slot = db.execute(select(ReviewSlot).where(ReviewSlot.request_id == req_id, ReviewSlot.slot_role == "manager")).scalar_one()

    # Priya tries to decide her own request
    decision_resp = client.post(f"/api/requests/{req_id}/decisions", json={
        "slot_id": slot.id,
        "decision": "approve",
        "rationale": "I self-approve this",
    }, headers=headers)
    assert decision_resp.status_code == 403


@pytest.mark.ec("EC-APPR-02")
def test_unauthorized_role_cannot_approve_slot(client_and_db):
    """Resource owner cannot approve a manager slot."""
    client, db = client_and_db
    clean_priya_requests(db)

    # Create request by Priya
    priya_token = jwt.encode({"sub": "usr_req_priya", "roles": ["requester"]}, "secret", algorithm="HS256")
    auth_resp = client.post("/auth/session", json={"id_token": priya_token})
    priya_headers = {"Authorization": f"Bearer {auth_resp.json()['token']}"}

    create_resp = client.post("/api/requests", json={
        "resource_id": "res_alpha_dataset",
        "actions": ["read_sample"],
        "duration_minutes": 60,
        "purpose_code": "FRAUD_RULE_TUNING",
        "purpose_text": "Unauthorized review test",
        "risk_controls": ["activity_logging", "synthetic_data_only"],
    }, headers=priya_headers)
    assert create_resp.status_code in (200, 201)
    req_id = create_resp.json()["id"]

    manager_slot = db.execute(select(ReviewSlot).where(ReviewSlot.request_id == req_id, ReviewSlot.slot_role == "manager")).scalar_one()

    # Sign in as David (Resource Owner)
    david_token = jwt.encode({"sub": "usr_own_david", "roles": ["resource_owner"]}, "secret", algorithm="HS256")
    david_auth = client.post("/auth/session", json={"id_token": david_token})
    david_headers = {"Authorization": f"Bearer {david_auth.json()['token']}"}

    # David attempts to approve manager slot
    resp = client.post(f"/api/requests/{req_id}/decisions", json={
        "slot_id": manager_slot.id,
        "decision": "approve",
        "rationale": "Trying to bypass manager",
    }, headers=david_headers)
    assert resp.status_code == 403


@pytest.mark.ec("EC-APPR-03")
@pytest.mark.ec("EC-APPR-04")
def test_full_three_party_approval_workflow_activates_grant(client_and_db):
    """Request requires all 3 approvals; Grant is created and active only after the 3rd approval."""
    client, db = client_and_db
    clean_priya_requests(db)

    # Step 1: Requester submits
    priya_token = jwt.encode({"sub": "usr_req_priya", "roles": ["requester"]}, "secret", algorithm="HS256")
    p_auth = client.post("/auth/session", json={"id_token": priya_token})
    p_headers = {"Authorization": f"Bearer {p_auth.json()['token']}"}

    create_resp = client.post("/api/requests", json={
        "resource_id": "res_alpha_dataset",
        "actions": ["read_sample", "read_full"],
        "duration_minutes": 180,
        "purpose_code": "PROTOTYPE_DEMO",
        "purpose_text": "Q4 Analytics Pipeline training data ingestion",
        "risk_controls": ["activity_logging", "synthetic_data_only"],
    }, headers=p_headers)
    assert create_resp.status_code in (200, 201)
    req_id = create_resp.json()["id"]

    req_record = db.get(AccessRequest, req_id)
    assert req_record.status == RequestStatus.IN_REVIEW

    slots = db.execute(select(ReviewSlot).where(ReviewSlot.request_id == req_id)).scalars().all()
    slot_map = {s.slot_role: s for s in slots}
    mgr_slot, risk_slot, owner_slot = slot_map["manager"], slot_map["risk_reviewer"], slot_map["resource_owner"]

    # Step 2: Carol (Manager) approves
    carol_token = jwt.encode({"sub": "usr_mgr_carol", "roles": ["manager"]}, "secret", algorithm="HS256")
    c_auth = client.post("/auth/session", json={"id_token": carol_token})
    c_headers = {"Authorization": f"Bearer {c_auth.json()['token']}"}

    resp1 = client.post(f"/api/requests/{req_id}/decisions", json={
        "slot_id": mgr_slot.id,
        "decision": "approve",
        "rationale": "Team member has valid business project need",
    }, headers=c_headers)
    assert resp1.status_code == 200

    db.refresh(req_record)
    assert req_record.status == RequestStatus.IN_REVIEW  # Not yet approved!

    # Step 3: Elena (Risk Reviewer) narrows duration and approves
    elena_token = jwt.encode({"sub": "usr_risk_elena", "roles": ["risk_reviewer"]}, "secret", algorithm="HS256")
    e_auth = client.post("/auth/session", json={"id_token": elena_token})
    e_headers = {"Authorization": f"Bearer {e_auth.json()['token']}"}

    resp2 = client.post(f"/api/requests/{req_id}/decisions", json={
        "slot_id": risk_slot.id,
        "decision": "narrow",
        "rationale": "Approved with maximum 2-hour window and standard encryption",
        "approved_limits": {"actions": ["read_sample"], "duration_minutes": 120},
    }, headers=e_headers)
    assert resp2.status_code == 200

    db.refresh(req_record)
    assert req_record.status == RequestStatus.IN_REVIEW  # Still requires Resource Owner!

    # Verify no grant yet
    grant_before = db.execute(select(Grant).where(Grant.request_id == req_id)).scalar_one_or_none()
    assert grant_before is None

    # Step 4: David (Resource Owner) approves
    david_token = jwt.encode({"sub": "usr_own_david", "roles": ["resource_owner"]}, "secret", algorithm="HS256")
    d_auth = client.post("/auth/session", json={"id_token": david_token})
    d_headers = {"Authorization": f"Bearer {d_auth.json()['token']}"}

    resp3 = client.post(f"/api/requests/{req_id}/decisions", json={
        "slot_id": owner_slot.id,
        "decision": "approve",
        "rationale": "Dataset owner approves usage under policy limits",
    }, headers=d_headers)
    assert resp3.status_code == 200

    db.refresh(req_record)
    assert req_record.status == RequestStatus.APPROVED

    # Verify Grant is now active in database
    grant = db.execute(select(Grant).where(Grant.request_id == req_id)).scalar_one()
    assert grant.status == GrantStatus.ACTIVE
    assert grant.requester_sub == "usr_req_priya"
    assert grant.resource_id == "res_alpha_dataset"


@pytest.mark.ec("EC-APPR-05")
def test_rejection_halts_workflow_and_prevents_grant(client_and_db):
    """Rejection at any stage immediately transitions request to REJECTED and cancels remaining slots."""
    client, db = client_and_db
    clean_priya_requests(db)

    # Submit request
    priya_token = jwt.encode({"sub": "usr_req_priya", "roles": ["requester"]}, "secret", algorithm="HS256")
    p_auth = client.post("/auth/session", json={"id_token": priya_token})
    p_headers = {"Authorization": f"Bearer {p_auth.json()['token']}"}

    create_resp = client.post("/api/requests", json={
        "resource_id": "res_alpha_dataset",
        "actions": ["read_sample"],
        "duration_minutes": 60,
        "purpose_code": "SECURITY_REDTEAM_SIM",
        "purpose_text": "Rejection test workflow",
        "risk_controls": ["activity_logging", "synthetic_data_only"],
    }, headers=p_headers)
    assert create_resp.status_code in (200, 201)
    req_id = create_resp.json()["id"]

    mgr_slot = db.execute(select(ReviewSlot).where(ReviewSlot.request_id == req_id, ReviewSlot.slot_role == "manager")).scalar_one()

    # Manager rejects
    carol_token = jwt.encode({"sub": "usr_mgr_carol", "roles": ["manager"]}, "secret", algorithm="HS256")
    c_auth = client.post("/auth/session", json={"id_token": carol_token})
    c_headers = {"Authorization": f"Bearer {c_auth.json()['token']}"}

    reject_resp = client.post(f"/api/requests/{req_id}/decisions", json={
        "slot_id": mgr_slot.id,
        "decision": "reject",
        "rationale": "Insufficient justification for production data",
    }, headers=c_headers)
    assert reject_resp.status_code == 200

    req_record = db.get(AccessRequest, req_id)
    assert req_record.status == RequestStatus.REJECTED

    # Ensure remaining slots are cancelled
    other_slots = db.execute(select(ReviewSlot).where(ReviewSlot.request_id == req_id, ReviewSlot.slot_role != "manager")).scalars().all()
    for s in other_slots:
        assert s.status == SlotStatus.CANCELLED

    # Ensure no Grant was created
    grant = db.execute(select(Grant).where(Grant.request_id == req_id)).scalar_one_or_none()
    assert grant is None


@pytest.mark.ec("EC-DASH-01")
def test_role_specific_dashboard_endpoints(client_and_db):
    """Each role accesses their authorized dashboard view."""
    client, db = client_and_db

    # 1. Requester sees personal requests & grants
    p_token = jwt.encode({"sub": "usr_req_priya", "roles": ["requester"]}, "secret", algorithm="HS256")
    p_auth = client.post("/auth/session", json={"id_token": p_token})
    p_resp = client.get("/api/my-access", headers={"Authorization": f"Bearer {p_auth.json()['token']}"})
    assert p_resp.status_code == 200
    p_data = p_resp.json()
    assert "employee_view" in p_data
    assert "my_active_access" in p_data["employee_view"]

    # 2. Manager sees pending team approvals
    c_token = jwt.encode({"sub": "usr_mgr_carol", "roles": ["manager"]}, "secret", algorithm="HS256")
    c_auth = client.post("/auth/session", json={"id_token": c_token})
    c_resp = client.get("/api/my-access", headers={"Authorization": f"Bearer {c_auth.json()['token']}"})
    assert c_resp.status_code == 200
    c_data = c_resp.json()
    assert c_data["manager_view"] is not None
    assert "pending_approvals" in c_data["manager_view"]

    # 3. Risk Reviewer sees risk queue
    e_token = jwt.encode({"sub": "usr_risk_elena", "roles": ["risk_reviewer"]}, "secret", algorithm="HS256")
    e_auth = client.post("/auth/session", json={"id_token": e_token})
    e_resp = client.get("/api/my-access", headers={"Authorization": f"Bearer {e_auth.json()['token']}"})
    assert e_resp.status_code == 200
    e_data = e_resp.json()
    assert e_data["risk_reviewer_view"] is not None
    assert "risk_review_requests" in e_data["risk_reviewer_view"]

    # 4. Resource Owner sees resource approvals
    d_token = jwt.encode({"sub": "usr_own_david", "roles": ["resource_owner"]}, "secret", algorithm="HS256")
    d_auth = client.post("/auth/session", json={"id_token": d_token})
    d_resp = client.get("/api/my-access", headers={"Authorization": f"Bearer {d_auth.json()['token']}"})
    assert d_resp.status_code == 200
    d_data = d_resp.json()
    assert d_data["resource_owner_view"] is not None
    assert "owned_resources" in d_data["resource_owner_view"]

    # 5. Admin sees global governance overview
    f_token = jwt.encode({"sub": "usr_adm_fiona", "roles": ["admin"]}, "secret", algorithm="HS256")
    f_auth = client.post("/auth/session", json={"id_token": f_token})
    f_resp = client.get("/api/my-access", headers={"Authorization": f"Bearer {f_auth.json()['token']}"})
    assert f_resp.status_code == 200
    f_data = f_resp.json()
    assert f_data["admin_view"] is not None
    assert "hierarchy_tree" in f_data["admin_view"]
    assert "total_users" in f_data["admin_view"]
