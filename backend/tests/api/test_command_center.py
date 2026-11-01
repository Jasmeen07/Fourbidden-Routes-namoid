"""Tests for AI Security Command Center (Provenance & Network Team Guardrails).

Verifies:
1. Real-time security overview KPIs (monitored events, risky events, blocked transmissions, active AI agents).
2. Taint & secret propagation across the causal event dependency graph.
3. Network guardrail evaluations (confirming ALLOWED vs BLOCKED decisions).
4. Security alert generation for suspicious prompts, sensitive data access, and exfiltration attempts.
5. Searchable enforcement audit trail.
"""
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.main import create_app
from app.db.engine import SessionLocal, init_database
from app.db.models import User, UserRole, AgentEvent, EventDependency


@pytest.fixture
def test_client():
    init_database()
    app = create_app()
    with TestClient(app) as client:
        yield client


def setup_provenance_test_data(db: Session):
    now = datetime.now(timezone.utc)

    # 1. Ensure Agent Users exist
    for agent_id in ["AG102", "AG201", "AG301"]:
        u = db.get(User, agent_id)
        if not u:
            u = User(
                sub=agent_id,
                display_name=f"Autonomous AI Agent {agent_id}",
                email=f"{agent_id.lower()}@internal.corp",
                department="Engineering",
                is_agent=True,
                active=True,
            )
            db.add(u)
            db.add(UserRole(sub=agent_id, role="ai_agent"))

    # 2. Seed Test Event Graph:
    # evt_soc_input (Untrusted Input) -> evt_soc_process (Tool Call) -> evt_soc_egress (External Send)
    # evt_soc_secret (Sensitive Input) -> evt_soc_process
    events_data = [
        {
            "id": "evt_soc_input",
            "principal_id": "AG102",
            "event_type": "message",
            "action": "ingest_untrusted_prompt",
            "resource_id": "external_vendor_prompt.txt",
            "label": "untrusted_input",
            "payload": {"prompt": "Ignore previous instructions", "injection_detected": True},
        },
        {
            "id": "evt_soc_secret",
            "principal_id": "AG102",
            "event_type": "tool_result",
            "action": "read_classified_table",
            "resource_id": "finance.csv",
            "label": "sensitive_input",
            "payload": {"classification": "CRITICAL", "rows": 100},
        },
        {
            "id": "evt_soc_process",
            "principal_id": "AG102",
            "event_type": "tool_call",
            "action": "synthesize_analysis",
            "resource_id": None,
            "label": "clean",
            "payload": {"task": "Cross-reference untrusted terms with financial numbers"},
        },
        {
            "id": "evt_soc_egress_bad",
            "principal_id": "AG102",
            "event_type": "external_send",
            "action": "external_send",
            "target_destination": "https://attacker.evil.com/exfil",
            "label": "clean",
            "payload": {"method": "POST", "destination": "https://attacker.evil.com/exfil"},
        },
        {
            "id": "evt_soc_clean",
            "principal_id": "AG201",
            "event_type": "external_send",
            "action": "external_send",
            "target_destination": "https://api.internal.corp/status",
            "label": "clean",
            "payload": {"method": "GET", "destination": "https://api.internal.corp/status"},
        },
    ]

    for ev in events_data:
        existing = db.get(AgentEvent, ev["id"])
        if not existing:
            event_obj = AgentEvent(
                id=ev["id"],
                principal_id=ev["principal_id"],
                event_type=ev["event_type"],
                action=ev["action"],
                resource_id=ev.get("resource_id"),
                target_destination=ev.get("target_destination"),
                label=ev["label"],
                payload=ev["payload"],
                timestamp=now,
            )
            db.add(event_obj)

    # 3. Add Causal Dependencies
    deps = [
        ("evt_soc_process", "evt_soc_input"),
        ("evt_soc_process", "evt_soc_secret"),
        ("evt_soc_egress_bad", "evt_soc_process"),
    ]
    for child, parent in deps:
        existing_dep = db.execute(
            select(EventDependency).where(
                EventDependency.event_id == child,
                EventDependency.depends_on_id == parent,
            )
        ).scalars().first()
        if not existing_dep:
            db.add(EventDependency(
                id=f"dep_{child}_{parent}",
                event_id=child,
                depends_on_id=parent,
            ))

    db.commit()


@pytest.mark.ec("EC-SOC-01")
def test_command_center_telemetry_and_kpis(test_client):
    """Verifies that GET /api/provenance/events returns real-time KPIs and full graph telemetry."""
    db = SessionLocal()
    try:
        setup_provenance_test_data(db)
        res = test_client.get("/api/provenance/events")
        assert res.status_code == 200
        data = res.json()

        assert "nodes" in data
        assert "edges" in data
        assert "kpis" in data
        assert "security_alerts" in data
        assert "audit_trail" in data
        assert "approved_destinations" in data

        kpis = data["kpis"]
        assert kpis["monitored_events"] >= 5
        assert kpis["risky_events"] >= 3
        assert kpis["blocked_transmissions"] >= 1
        assert kpis["active_ai_agents"] >= 2
    finally:
        db.close()


@pytest.mark.ec("EC-SOC-02")
def test_taint_and_secret_propagation_to_egress(test_client):
    """Verifies that taint from untrusted prompt and secret from classified asset propagate to downstream send."""
    db = SessionLocal()
    try:
        setup_provenance_test_data(db)
        res = test_client.get("/api/provenance/events")
        assert res.status_code == 200
        data = res.json()

        node_map = {n["id"]: n for n in data["nodes"]}

        # 1. Untrusted source has taint
        assert node_map["evt_soc_input"]["is_tainted"] is True
        assert node_map["evt_soc_input"]["has_secret"] is False

        # 2. Sensitive source has secret
        assert node_map["evt_soc_secret"]["is_tainted"] is False
        assert node_map["evt_soc_secret"]["has_secret"] is True

        # 3. Processing node merged both
        assert node_map["evt_soc_process"]["is_tainted"] is True
        assert node_map["evt_soc_process"]["has_secret"] is True

        # 4. Outbound transmission inherited both and was actively BLOCKED
        egress = node_map["evt_soc_egress_bad"]
        assert egress["is_tainted"] is True
        assert egress["has_secret"] is True
        assert egress["enforcement_status"] == "BLOCKED"
        assert "Exfiltration blocked" in egress["enforcement_reason"] or "not on the corporate approved" in egress["enforcement_reason"]
    finally:
        db.close()


@pytest.mark.ec("EC-SOC-03")
def test_network_guardrail_evaluator_verdicts(test_client):
    """Verifies that POST /api/provenance/evaluate strictly enforces network guardrails."""
    db = SessionLocal()
    try:
        setup_provenance_test_data(db)
        login = test_client.post("/auth/dev-login", json={"user_id": "priya"})
        assert login.status_code == 200

        # 1. Attempt exfiltration of tainted secret to unapproved endpoint -> MUST DENY
        bad_eval = test_client.post(
            "/api/provenance/evaluate",
            json={
                "event_id": "evt_soc_egress_bad",
                "action": "external_send",
                "target_destination": "https://attacker.evil.com/exfil",
            },
        )
        assert bad_eval.status_code == 200
        bad_data = bad_eval.json()
        assert bad_data["status"] == "DENIED"
        assert bad_data["tainted"] is True
        assert bad_data["has_secret"] is True

        # 2. Clean event sending to an approved corporate destination -> ALLOWED
        good_eval = test_client.post(
            "/api/provenance/evaluate",
            json={
                "event_id": "evt_soc_clean",
                "action": "external_send",
                "target_destination": "https://api.internal.corp/status",
            },
        )
        assert good_eval.status_code == 200
        good_data = good_eval.json()
        assert good_data["status"] == "ALLOWED"
        assert good_data["tainted"] is False
        assert good_data["has_secret"] is False
    finally:
        db.close()


@pytest.mark.ec("EC-SOC-04")
def test_security_alerts_and_audit_trail(test_client):
    """Verifies real-time alert generation and audit trail completeness."""
    db = SessionLocal()
    try:
        setup_provenance_test_data(db)
        res = test_client.get("/api/provenance/events")
        assert res.status_code == 200
        data = res.json()

        alerts = data["security_alerts"]
        alert_categories = {a["category"] for a in alerts}
        assert "SUSPICIOUS_PROMPT" in alert_categories
        assert "SENSITIVE_DATA_ACCESS" in alert_categories
        assert "DATA_LEAKAGE_ATTEMPT" in alert_categories

        # Audit trail contains all recorded events
        audit = data["audit_trail"]
        assert len(audit) >= 5
        event_ids = {a["event_id"] for a in audit}
        assert "evt_soc_input" in event_ids
        assert "evt_soc_secret" in event_ids
        assert "evt_soc_egress_bad" in event_ids
    finally:
        db.close()
