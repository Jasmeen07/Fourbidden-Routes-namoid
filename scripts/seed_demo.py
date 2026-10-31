"""Seed demo users, roles, and mock resources (BLUEPRINT §5.4, §6.5, §7.2, §13)."""
import os
import sys
from datetime import datetime, timezone, timedelta
import yaml

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.engine import init_database, SessionLocal
from app.db.models import User, UserRole, Resource
from app.services.audit import AuditService


def seed_demo():
    print("Initializing database and triggers...")
    init_database()
    db = SessionLocal()
    now = datetime.now(timezone.utc)

    # 1. Seed Users (Pass 1: insert users without manager_sub to satisfy FK constraints)
    users_seed_file = os.path.join("config", "users.seed.yaml")
    with open(users_seed_file, "r", encoding="utf-8") as fp:
        users_data = yaml.safe_load(fp).get("users", [])

    for u_data in users_data:
        existing_user = db.get(User, u_data["sub"])
        if not existing_user:
            user = User(
                sub=u_data["sub"],
                display_name=u_data["display_name"],
                email=u_data.get("email"),
                manager_sub=None,  # Set in pass 2
                is_agent=u_data.get("is_agent", False),
                owner_sub=u_data.get("owner_sub"),
                department=u_data.get("department", "General"),
                employee_id=u_data.get("employee_id"),
                delegated_permissions=u_data.get("delegated_permissions"),
                active=u_data.get("active", True),
            )
            db.add(user)
        else:
            existing_user.is_agent = u_data.get("is_agent", False)
            existing_user.owner_sub = u_data.get("owner_sub")
            existing_user.department = u_data.get("department", "General")
            existing_user.employee_id = u_data.get("employee_id")
            existing_user.delegated_permissions = u_data.get("delegated_permissions")
    db.flush()

    # Pass 2: update manager_sub and roles
    for u_data in users_data:
        user = db.get(User, u_data["sub"])
        if user and u_data.get("manager_sub"):
            user.manager_sub = u_data["manager_sub"]

        for role in u_data.get("roles", []):
            existing_role = db.get(UserRole, (u_data["sub"], role))
            if not existing_role:
                db.add(UserRole(sub=u_data["sub"], role=role))
    db.flush()

    # 2. Seed Mock Resources
    res_seed_file = os.path.join("config", "resources.seed.yaml")
    with open(res_seed_file, "r", encoding="utf-8") as fp:
        resources_data = yaml.safe_load(fp).get("resources", [])

    for r_data in resources_data:
        existing_res = db.get(Resource, r_data["id"])
        if not existing_res:
            res = Resource(
                id=r_data["id"],
                name=r_data["name"],
                kind=r_data["kind"],
                tier=r_data["tier"],
                department=r_data.get("department", "General"),
                sensitivity=r_data.get("sensitivity", "INTERNAL"),
                is_crucial=r_data.get("is_crucial", False),
                owner_sub=r_data["owner_sub"],
                allowed_actions=r_data["allowed_actions"],
                active=r_data.get("active", True),
            )
            db.add(res)
        else:
            existing_res.department = r_data.get("department", "General")
            existing_res.sensitivity = r_data.get("sensitivity", "INTERNAL")
            existing_res.is_crucial = r_data.get("is_crucial", False)

    db.commit()

    # 3. Seed Sample FORGE Event Dependency Graph (§2.1, §3)
    from app.db.models import AgentEvent, EventDependency
    sample_events = [
        AgentEvent(
            id="evt_vendor_doc",
            principal_id="AG102",
            event_type="message",
            action="read_vendor_doc",
            resource_id="vendor_doc.txt",
            label="untrusted_input",
            payload={"source": "External Vendor Supply Chain Doc", "injection_detected": True},
            timestamp=now,
        ),
        AgentEvent(
            id="evt_finance_read",
            principal_id="AG102",
            event_type="tool_result",
            action="read_sample",
            resource_id="finance.csv",
            label="sensitive_input",
            payload={"dataset": "finance.csv", "rows": 50, "classification": "CRITICAL"},
            timestamp=now,
        ),
        AgentEvent(
            id="evt_report_gen",
            principal_id="AG102",
            event_type="tool_call",
            action="generate_summary",
            resource_id=None,
            label="clean",
            payload={"task": "Cross-reference vendor terms with financial balances"},
            timestamp=now,
        ),
        AgentEvent(
            id="evt_send_external",
            principal_id="AG102",
            event_type="external_send",
            action="external_send",
            resource_id=None,
            target_destination="https://unknown-exfil.org/webhook",
            label="clean",
            payload={"destination": "https://unknown-exfil.org/webhook", "method": "POST"},
            timestamp=now,
        ),
    ]

    for ev in sample_events:
        if not db.get(AgentEvent, ev.id):
            db.add(ev)
    db.flush()

    sample_deps = [
        ("evt_report_gen", "evt_vendor_doc"),
        ("evt_report_gen", "evt_finance_read"),
        ("evt_send_external", "evt_report_gen"),
    ]
    for child, parent in sample_deps:
        existing_dep = db.query(EventDependency).filter_by(event_id=child, depends_on_id=parent).first()
        if not existing_dep:
            db.add(EventDependency(id=f"dep_{child}_{parent}", event_id=child, depends_on_id=parent))

    # 4. Seed ServiceNow-inspired SecOps Cybersecurity Data
    from app.db.models import ThreatIntelIndicator, IpReputation, SecurityIncident, SecurityEvent
    
    sample_threat_intel = [
        ThreatIntelIndicator(
            id="ioc_c2_01",
            type="IP",
            value="198.51.100.42",
            threat_actor="APT29 / Cozy Bear",
            campaign="SolarWinds Supply Chain",
            confidence=95,
            description="Active Command & Control (C2) node associated with state-sponsored espionage.",
            added_at=now,
            is_active=True,
        ),
        ThreatIntelIndicator(
            id="ioc_phish_02",
            type="IP",
            value="203.0.113.88",
            threat_actor="FIN7 / Carbanak",
            campaign="Corporate Phishing & Credential Harvest",
            confidence=90,
            description="Malicious proxy node used in targeted credential phishing.",
            added_at=now,
            is_active=True,
        ),
        ThreatIntelIndicator(
            id="ioc_domain_03",
            type="DOMAIN",
            value="evil-exfil.xyz",
            threat_actor="BlackCat / ALPHV",
            campaign="Double Extortion Ransomware",
            confidence=90,
            description="Exfiltration endpoint for staging compromised corporate data.",
            added_at=now,
            is_active=True,
        ),
        ThreatIntelIndicator(
            id="ioc_hash_04",
            type="HASH",
            value="44d88612fea8a8f36de82e1278abb02f",
            threat_actor="Generic Trojan",
            campaign="Wiper & Dropper Payload",
            confidence=99,
            description="Known malicious payload hash verified across multi-vendor EDR feeds.",
            added_at=now,
            is_active=True,
        ),
    ]

    for ti in sample_threat_intel:
        if not db.get(ThreatIntelIndicator, ti.id):
            db.add(ti)

    sample_ips = [
        IpReputation(
            ip="127.0.0.1",
            status="ALLOWLISTED",
            risk_score=0,
            malicious_attempts=0,
            last_seen_at=now,
            blocked_until=None,
            block_reason="Localhost administrative loopback",
            manual_override=True,
        ),
        IpReputation(
            ip="10.0.4.15",
            status="CLEAN",
            risk_score=0,
            malicious_attempts=0,
            last_seen_at=now,
            blocked_until=None,
            block_reason=None,
            manual_override=False,
        ),
        IpReputation(
            ip="198.51.100.42",
            status="PERM_BLOCKED",
            risk_score=95,
            malicious_attempts=4,
            last_seen_at=now,
            blocked_until=now + timedelta(days=365),
            block_reason="Threat Intel Feed: CobaltStrike C2",
            manual_override=True,
        ),
        IpReputation(
            ip="192.0.2.144",
            status="TEMP_BLOCKED",
            risk_score=85,
            malicious_attempts=3,
            last_seen_at=now,
            blocked_until=now + timedelta(minutes=45),
            block_reason="Repeated SQL Injection attempts detected",
            manual_override=False,
        ),
    ]

    for ip_rep in sample_ips:
        if not db.get(IpReputation, ip_rep.ip):
            db.add(ip_rep)

    if not db.get(SecurityIncident, "INC-2026-10001"):
        demo_incident = SecurityIncident(
            id="INC-2026-10001",
            title="WAF Defense Alert: SQLI detected from 192.0.2.144",
            description="Repeated SQL injection payloads (' UNION SELECT password FROM users --) blocked at API gateway boundary.",
            severity="CRITICAL",
            priority="P1",
            status="CONTAINED",
            source_ip="192.0.2.144",
            user_sub="E102",
            assigned_to="R001",
            created_at=now,
            updated_at=now,
            resolved_at=None,
            resolution_notes=None,
            investigation_notes=[
                {
                    "author": "System WAF / SecOps Engine",
                    "timestamp": now.isoformat(),
                    "text": "Incident auto-triaged to P1. Automatic temporary IP isolation enforced.",
                },
                {
                    "author": "R001 (Rachel Ramos)",
                    "timestamp": now.isoformat(),
                    "text": "Confirmed adversarial probing of finance dataset queries. SOAR containment executed.",
                },
            ],
        )
        db.add(demo_incident)

    if not db.get(SecurityEvent, "sec_evt_demo_sqli"):
        demo_event = SecurityEvent(
            id="sec_evt_demo_sqli",
            timestamp=now,
            source_ip="192.0.2.144",
            user_sub="E102",
            method="POST",
            path="/api/resources/finance.csv/query",
            category="SQLI",
            pattern_matched="SQLI_SQL_KEYWORD_INJECTION",
            risk_score=85,
            severity="CRITICAL",
            action_taken="BLOCKED",
            repeat_count=3,
            incident_id="INC-2026-10001",
            payload_snippet="{\"query\": \"' UNION SELECT * FROM users --\"}",
            status="BLOCKED_BY_WAF",
        )
        db.add(demo_event)

    db.commit()

    # 5. Initial audit event
    AuditService.append_event(
        session=db,
        event_type="POLICY_LOADED",
        subject_type="system",
        subject_id="bootstrap",
        payload={"message": "Demo users, roles, resources, and SecOps threat intelligence successfully seeded"},
        actor_sub="system",
        now=now,
    )
    db.commit()
    db.close()
    print("Database seeding completed successfully!")


if __name__ == "__main__":
    seed_demo()
