"""Deterministic Sample Access History Generator (BLUEPRINT §13, SUB-4)."""
import os
import sys
import csv
import json
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.engine import init_database
from app.db.models import User, UserRole, Resource, AuditEvent
from app.domain.policy import parse_policy_yaml
from app.domain.hashing import verify_audit_chain
from app.services.requests import RequestsService
from app.services.reviews import ReviewsService
from app.services.grants import GrantsService
from app.services.gateway import SimulationGateway
from app.services.audit import AuditService, format_iso_ts
from app.domain.errors import SodSelfReviewError


def generate_sample_history():
    print("Generating deterministic sample access history...")
    temp_db_path = "grantgate_sample_history.db"
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)

    engine = create_engine(f"sqlite:///{temp_db_path}")
    init_database(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Load policy
    with open("config/policy.yaml", "r", encoding="utf-8") as fp:
        policy = parse_policy_yaml(fp.read())

    # Seed base users
    users = [
        User(sub="usr_req_a", display_name="Alice Requester", email="alice@test.com", manager_sub="usr_mgr_1", active=True),
        User(sub="usr_req_b", display_name="Bob DualRole", email="bob@test.com", manager_sub="usr_mgr_1", active=True),
        User(sub="usr_mgr_1", display_name="Mary Manager", email="mary@test.com", active=True),
        User(sub="usr_risk_1", display_name="Rachel RiskReviewer", email="rachel@test.com", active=True),
        User(sub="usr_owner_1", display_name="Oscar ResourceOwner", email="oscar@test.com", active=True),
    ]
    roles = [
        UserRole(sub="usr_req_a", role="requester"),
        UserRole(sub="usr_req_b", role="requester"),
        UserRole(sub="usr_req_b", role="risk_reviewer"),
        UserRole(sub="usr_mgr_1", role="manager"),
        UserRole(sub="usr_risk_1", role="risk_reviewer"),
        UserRole(sub="usr_owner_1", role="resource_owner"),
    ]
    resources = [
        Resource(
            id="M-sentiment-v1",
            name="Customer Sentiment Model v1",
            kind="model",
            tier="INTERNAL_SYNTHETIC",
            owner_sub="usr_owner_1",
            allowed_actions=[
                {"name": "view_metadata", "risk_weight": 1},
                {"name": "query", "risk_weight": 2},
                {"name": "batch_query", "risk_weight": 3},
            ],
            active=True,
        ),
        Resource(
            id="D-claims-synth",
            name="Synthetic Insurance Claims Dataset",
            kind="dataset",
            tier="RESTRICTED_SYNTHETIC",
            owner_sub="usr_owner_1",
            allowed_actions=[
                {"name": "read_sample", "risk_weight": 2},
                {"name": "read_full", "risk_weight": 5},
                {"name": "export_masked", "risk_weight": 7},
            ],
            active=True,
        ),
    ]

    for u in users:
        db.add(u)
    for r in roles:
        db.add(r)
    for res in resources:
        db.add(res)
    db.commit()

    # Fixed base time for 100% byte-identical determinism
    t = datetime(2026, 10, 31, 9, 0, 0, tzinfo=timezone.utc)

    # Scenario 1: Alice submits request for sentiment model
    req1 = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub="usr_req_a",
        resource_id="M-sentiment-v1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Fairness evaluation on synthetic sentiment model",
        actions=["query", "batch_query"],
        duration_minutes=30,
        risk_controls=["activity_logging", "synthetic_data_only"],
        now=t,
    )
    db.commit()

    # Scenario 2: Manager approves, Risk narrows to [query] only 15 min, Owner approves
    t += timedelta(minutes=5)
    mgr_slot = next(s for s in req1.slots if s.slot_role == "manager")
    ReviewsService.record_decision(
        db=db, request_id=req1.id, slot_id=mgr_slot.id, decision="approve", reviewer_sub="usr_mgr_1", now=t
    )
    db.commit()

    t += timedelta(minutes=5)
    risk_slot = next(s for s in req1.slots if s.slot_role == "risk_reviewer")
    ReviewsService.record_decision(
        db=db,
        request_id=req1.id,
        slot_id=risk_slot.id,
        decision="narrow",
        reviewer_sub="usr_risk_1",
        approved_limits={"actions": ["query"], "duration_minutes": 15},
        rationale="Narrowing to single query to control load",
        now=t,
    )
    db.commit()

    t += timedelta(minutes=5)
    owner_slot = next(s for s in req1.slots if s.slot_role == "resource_owner")
    _, _, grant1 = ReviewsService.record_decision(
        db=db, request_id=req1.id, slot_id=owner_slot.id, decision="approve", reviewer_sub="usr_owner_1", now=t
    )
    db.commit()

    # Scenario 3: Alice invokes allowed action query -> ALLOW
    t += timedelta(minutes=2)
    SimulationGateway.invoke(
        db=db, resource_id="M-sentiment-v1", action="query", declared_purpose="BIAS_AUDIT", caller_sub="usr_req_a", now=t
    )
    db.commit()

    # Scenario 4: Alice invokes out-of-scope batch_query -> DENY_ACTION_NOT_GRANTED
    t += timedelta(minutes=1)
    SimulationGateway.invoke(
        db=db, resource_id="M-sentiment-v1", action="batch_query", declared_purpose="BIAS_AUDIT", caller_sub="usr_req_a", now=t
    )
    db.commit()

    # Scenario 5: Alice invokes with wrong purpose -> DENY_PURPOSE_MISMATCH
    t += timedelta(minutes=1)
    SimulationGateway.invoke(
        db=db, resource_id="M-sentiment-v1", action="query", declared_purpose="MODEL_EVALUATION", caller_sub="usr_req_a", now=t
    )
    db.commit()

    # Scenario 6: Bob (dual-role) attempts self-review on his own request -> 403 & SECURITY_TAMPER_ATTEMPT
    t += timedelta(minutes=10)
    req2 = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub="usr_req_b",
        resource_id="D-claims-synth",
        purpose_code="FRAUD_RULE_TUNING",
        purpose_text="Red-team testing claims risk thresholds",
        actions=["read_sample", "read_full"],
        duration_minutes=60,
        risk_controls=["activity_logging", "synthetic_data_only", "isolated_workspace"],
        now=t,
    )
    db.commit()

    bob_risk_slot = next(s for s in req2.slots if s.slot_role == "risk_reviewer")
    try:
        ReviewsService.record_decision(
            db=db, request_id=req2.id, slot_id=bob_risk_slot.id, decision="approve", reviewer_sub="usr_req_b", now=t
        )
    except SodSelfReviewError:
        pass
    db.commit()

    # Scenario 7: Risk reviewer rejects request 2
    t += timedelta(minutes=5)
    ReviewsService.record_decision(
        db=db,
        request_id=req2.id,
        slot_id=bob_risk_slot.id,
        decision="reject",
        reviewer_sub="usr_risk_1",
        rationale="Insufficient isolation controls for full dataset query ask",
        now=t,
    )
    db.commit()

    # Scenario 8: Grant 1 reaches expiry and is swept
    t += timedelta(minutes=25)
    GrantsService.tick_sweeper(db, policy, now=t)
    db.commit()

    # Verify chain using AuditService
    res = AuditService.verify_chain(db)
    assert res["ok"] is True, f"Chain verification failed: {res}"

    from app.services.audit import format_iso_ts
    events = db.query(AuditEvent).order_by(AuditEvent.seq.asc()).all()
    event_dicts = [
        {
            "seq": e.seq,
            "id": e.id,
            "ts": format_iso_ts(e.ts),
            "type": e.type,
            "actor_sub": e.actor_sub,
            "actor_role": e.actor_role,
            "subject_type": e.subject_type,
            "subject_id": e.subject_id,
            "payload": e.payload,
            "prev_hash": e.prev_hash,
            "hash": e.hash,
        }
        for e in events
    ]

    head_hash = event_dicts[-1]["hash"]
    print(f"Verified audit chain of {len(event_dicts)} events! Head hash: {head_hash}")

    # Export docs/sample_access_history.json
    json_path = os.path.join("docs", "sample_access_history.json")
    with open(json_path, "w", encoding="utf-8") as fp:
        json.dump({"verified": True, "head_hash": head_hash, "events": event_dicts}, fp, indent=2)

    # Export docs/sample_access_history.csv
    csv_path = os.path.join("docs", "sample_access_history.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as fp:
        writer = csv.writer(fp)
        writer.writerow(["seq", "id", "timestamp", "type", "actor_sub", "subject_type", "subject_id", "hash"])
        for e in event_dicts:
            writer.writerow([e["seq"], e["id"], e["ts"], e["type"], e["actor_sub"], e["subject_type"], e["subject_id"], e["hash"]])

    db.close()
    engine.dispose()
    if os.path.exists(temp_db_path):
        try:
            os.remove(temp_db_path)
        except Exception:
            pass
    print("docs/sample_access_history.json and .csv successfully written!")


if __name__ == "__main__":
    generate_sample_history()
