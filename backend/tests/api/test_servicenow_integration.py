"""Tests for ServiceNow SecOps SIR Integration Adapter & Webhooks (EC-SN01 through EC-SN05)."""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.main import create_app
from app.db.engine import SessionLocal, init_database
from app.db.models import User, UserRole, Resource, Grant, AccessRequest, SecurityIncident, SecurityEvent, AuditEvent
from app.ids import generate_id
from app.services.servicenow import ServiceNowService


@pytest.fixture
def sn_client():
    init_database()
    app = create_app()
    return TestClient(app)


def setup_sn_test_data(db: Session):
    now = datetime.now(timezone.utc)

    # 1. Ensure user
    user = db.get(User, "alice")
    if not user:
        user = User(
            sub="alice",
            display_name="Alice Chen",
            email="alice@test.com",
            department="Engineering",
            active=True,
        )
        db.add(user)
        db.add(UserRole(sub="alice", role="ML_ENGINEER"))

    david = db.get(User, "david")
    if not david:
        david = User(
            sub="david",
            display_name="David Martinez",
            email="david@test.com",
            department="Finance",
            active=True,
        )
        db.add(david)
        db.add(UserRole(sub="david", role="RESOURCE_OWNER"))

    # 2. Ensure resource
    res = db.get(Resource, "finance.csv")
    if not res:
        res = Resource(
            id="finance.csv",
            name="Financial Transactions",
            kind="dataset",
            tier="TIER_1_CRITICAL",
            department="Finance",
            sensitivity="CRITICAL",
            is_crucial=True,
            owner_sub="david",
            allowed_actions=[{"name": "query", "risk_weight": 5}, {"name": "export", "risk_weight": 9}],
            active=True,
        )
        db.add(res)

    db.commit()


@pytest.mark.ec("EC-SN01")
def test_auto_open_servicenow_incident_on_purpose_mismatch(sn_client):
    """EC-SN01: PDP purpose mismatch automatically opens a ServiceNow SIR ticket with audit logging."""
    db = SessionLocal()
    try:
        setup_sn_test_data(db)
        now = datetime.now(timezone.utc)

        # Create active grant for PROTOTYPE_DEMO
        req_id = generate_id("req")
        grant_id = generate_id("grant")
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="finance.csv",
            purpose_code="PROTOTYPE_DEMO",
            purpose_text="Valid demo purpose",
            actions=["query"],
            duration_minutes=60,
            risk_controls=["audit_log"],
            status="APPROVED",
            policy_version=1,
            content_hash="hash_pdp_sn_01",
            created_at=now,
        )
        db.add(req)
        db.flush()

        grant = Grant(
            id=grant_id,
            request_id=req_id,
            requester_sub="alice",
            resource_id="finance.csv",
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

        login_res = sn_client.post("/auth/dev-login", json={"user_id": "alice"})
        csrf = login_res.json()["csrf_token"]

        # Attempt invocation with WRONG purpose -> PDP triggers DENY_PURPOSE_MISMATCH
        res = sn_client.post(
            "/api/sim/invoke",
            headers={"X-CSRF-Token": csrf},
            json={
                "action": "query",
                "declared_purpose": "UNAUTHORIZED_SECONDARY_SALE",
                "grant_id": grant_id,
                "resource_id": "finance.csv",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["decision"] == "DENY"
        assert data["code"] == "DENY_PURPOSE_MISMATCH"
        assert data["violation"] is True

        # Verify ServiceNow Incident in response
        assert "servicenow_incident" in data
        sn_inc = data["servicenow_incident"]
        assert sn_inc is not None
        assert sn_inc["servicenow_number"].startswith("SIR00")
        assert sn_inc["servicenow_sys_id"].startswith("sn_sys_")
        assert sn_inc["webhook_status"] in ("DISPATCHED", "MOCKED")

        # Verify persisted SecurityIncident in DB
        inc_record = db.get(SecurityIncident, sn_inc["id"])
        assert inc_record is not None
        assert inc_record.servicenow_number == sn_inc["servicenow_number"]
        assert inc_record.status == "NEW"
        assert "DENY_PURPOSE_MISMATCH" in inc_record.title
        assert len(inc_record.investigation_notes) >= 1

        # Verify SecurityEvent was created
        sec_event = db.execute(
            select(SecurityEvent).where(SecurityEvent.incident_id == inc_record.id)
        ).scalar_one_or_none()
        assert sec_event is not None
        assert sec_event.pattern_matched == "DENY_PURPOSE_MISMATCH"

        # Verify audit trail contains SERVICENOW_SIR_OPENED event
        audit_ev = db.execute(
            select(AuditEvent).where(
                AuditEvent.type == "SERVICENOW_SIR_OPENED",
                AuditEvent.subject_id == inc_record.id,
            )
        ).scalar_one_or_none()
        assert audit_ev is not None
        assert audit_ev.payload["violation_code"] == "DENY_PURPOSE_MISMATCH"
        assert audit_ev.payload["target_resource"] == "finance.csv"
    finally:
        db.close()


@pytest.mark.ec("EC-SN02")
def test_auto_open_servicenow_incident_on_unauthorized_action(sn_client):
    """EC-SN02: PDP unauthorized action outside granted scope auto-opens a ServiceNow SIR ticket."""
    db = SessionLocal()
    try:
        setup_sn_test_data(db)
        now = datetime.now(timezone.utc)

        req_id = generate_id("req")
        grant_id = generate_id("grant")
        req = AccessRequest(
            id=req_id,
            requester_sub="alice",
            resource_id="finance.csv",
            purpose_code="PROTOTYPE_DEMO",
            purpose_text="Valid demo purpose",
            actions=["query"],  # Only query is granted
            duration_minutes=60,
            risk_controls=["audit_log"],
            status="APPROVED",
            policy_version=1,
            content_hash="hash_pdp_sn_02",
            created_at=now,
        )
        db.add(req)
        db.flush()

        grant = Grant(
            id=grant_id,
            request_id=req_id,
            requester_sub="alice",
            resource_id="finance.csv",
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

        login_res = sn_client.post("/auth/dev-login", json={"user_id": "alice"})
        csrf = login_res.json()["csrf_token"]

        # Attempt invocation with 'export' (not in granted actions) -> DENY_ACTION_NOT_GRANTED
        res = sn_client.post(
            "/api/sim/invoke",
            headers={"X-CSRF-Token": csrf},
            json={
                "action": "export",
                "declared_purpose": "PROTOTYPE_DEMO",
                "grant_id": grant_id,
                "resource_id": "finance.csv",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["decision"] == "DENY"
        assert data["code"] == "DENY_ACTION_NOT_GRANTED"
        assert data["violation"] is True

        sn_inc = data["servicenow_incident"]
        assert sn_inc is not None
        assert sn_inc["servicenow_number"].startswith("SIR00")
    finally:
        db.close()


@pytest.mark.ec("EC-SN03")
def test_servicenow_inbound_webhook_sync(sn_client):
    """EC-SN03: Inbound ServiceNow webhook updates incident status and appends investigation work notes."""
    db = SessionLocal()
    try:
        setup_sn_test_data(db)
        now = datetime.now(timezone.utc)

        # 1. Create a ServiceNow incident record
        inc = ServiceNowService.auto_open_sir_incident(
            db=db,
            violation_code="DENY_PURPOSE_MISMATCH",
            caller_sub="alice",
            resource_id="finance.csv",
            action="query",
            declared_purpose="ILLEGAL_EXFILTRATION",
            pdp_trace=[{"check_name": "purpose_matches", "status": "fail", "detail": "Illegal purpose declared"}],
            now=now,
        )
        db.commit()

        # 2. Simulate ServiceNow SecOps sending an inbound webhook updating state to INVESTIGATING (state '2')
        wh_payload = {
            "number": inc.servicenow_number,
            "correlation_id": inc.id,
            "state": "2",
            "assigned_to": "david",
            "work_notes": "SecOps Analyst David investigating potential API token compromise.",
            "author": "ServiceNow Analyst",
        }

        res = sn_client.post("/api/secops/servicenow/webhook", json=wh_payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "acknowledged"
        assert data["incident_id"] == inc.id
        assert data["incident_status"] == "INVESTIGATING"

        # Verify DB was updated
        db.refresh(inc)
        assert inc.status == "INVESTIGATING"
        assert inc.assigned_to == "david"
        assert inc.webhook_status == "ACKNOWLEDGED"
        assert len(inc.investigation_notes) >= 2
        assert "David investigating" in inc.investigation_notes[-1]["text"]

        # 3. Simulate resolving the incident in ServiceNow (state '6')
        res_resolve = sn_client.post("/api/secops/servicenow/webhook", json={
            "number": inc.servicenow_number,
            "correlation_id": inc.id,
            "state": "6",
            "resolution_notes": "Threat analyzed and contained; grant revoked.",
            "author": "ServiceNow Analyst",
        })
        assert res_resolve.status_code == 200
        assert res_resolve.json()["incident_status"] == "RESOLVED"

        db.refresh(inc)
        assert inc.status == "RESOLVED"
        assert inc.resolution_notes == "Threat analyzed and contained; grant revoked."
        assert inc.resolved_at is not None
    finally:
        db.close()


@pytest.mark.ec("EC-SN04")
def test_servicenow_status_and_test_endpoint(sn_client):
    """EC-SN04: ServiceNow telemetry status endpoint and test violation dispatcher."""
    login_res = sn_client.post("/auth/dev-login", json={"user_id": "alice"})
    csrf = login_res.json()["csrf_token"]

    # 1. Status endpoint
    status_res = sn_client.get("/api/secops/servicenow/status", headers={"X-CSRF-Token": csrf})
    assert status_res.status_code == 200
    st = status_res.json()
    assert st["enabled"] is True
    assert st["table"] == "sn_si_incident"
    assert "https://" in st["instance_url"]

    # 2. Test dispatch endpoint
    test_res = sn_client.post(
        "/api/secops/servicenow/test",
        headers={"X-CSRF-Token": csrf},
        json={
            "violation_code": "DENY_ACTION_NOT_DELEGATED",
            "caller_sub": "AG101",
            "resource_id": "finance.csv",
            "action": "export_all",
            "declared_purpose": "UNAUTHORIZED_BATCH_PROCESSING",
        },
    )
    assert test_res.status_code == 200
    t_data = test_res.json()
    assert t_data["servicenow_number"].startswith("SIR00")
    assert t_data["webhook_status"] in ("DISPATCHED", "MOCKED")
    assert t_data["payload_dispatched"]["number"] == t_data["incident_id"]
    assert "DENY_ACTION_NOT_DELEGATED" in t_data["payload_dispatched"]["short_description"]


@pytest.mark.ec("EC-SN05")
def test_auto_open_critical_sir_incident_on_tainted_exfiltration(sn_client):
    """EC-SN05: Confidential secret exfiltration violation auto-opens a P1 Critical ServiceNow SIR ticket."""
    db = SessionLocal()
    try:
        setup_sn_test_data(db)
        now = datetime.now(timezone.utc)

        inc = ServiceNowService.auto_open_sir_incident(
            db=db,
            violation_code="DENY_TAINTED_EXFILTRATION",
            caller_sub="AG102",
            resource_id="finance.csv",
            action="external_send",
            declared_purpose="DATA_BACKUP",
            pdp_trace=[{"check_name": "tainted_secret_exfiltration", "status": "fail", "detail": "Carries confidential secret"}],
            now=now,
        )
        db.commit()

        assert inc.severity == "CRITICAL"
        assert inc.priority == "P1"
        assert inc.webhook_payload["severity"] == "1 - Critical"
        assert inc.webhook_payload["priority"] == "1 - Critical"
        assert "Data Exfiltration & Compliance Breach" in inc.webhook_payload["category"]
    finally:
        db.close()
