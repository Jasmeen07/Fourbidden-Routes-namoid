"""End-to-end Access Request and Multi-Party Governance workflow test."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.engine import init_database
from app.db.models import User, UserRole, Resource, AccessRequest, Grant
from app.domain.policy import parse_policy_yaml
from app.services.requests import RequestsService
from app.services.reviews import ReviewsService
from app.services.grants import GrantsService
from app.services.gateway import SimulationGateway
from app.domain.states import RequestStatus, SlotStatus, GrantStatus


@pytest.fixture
def e2e_setup(tmp_path):
    db_file = tmp_path / "e2e_workflow.db"
    engine = create_engine(f"sqlite:///{db_file}")
    init_database(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    with open("config/policy.yaml", "r", encoding="utf-8") as fp:
        policy = parse_policy_yaml(fp.read())

    users = [
        User(sub="usr_dev", display_name="Dev Requester", email="dev@test.com", manager_sub="usr_mgr", active=True),
        User(sub="usr_mgr", display_name="Manager Reviewer", email="mgr@test.com", active=True),
        User(sub="usr_owner", display_name="Dataset Owner", email="owner@test.com", active=True),
        User(sub="usr_risk", display_name="Risk Officer", email="risk@test.com", active=True),
    ]
    roles = [
        UserRole(sub="usr_dev", role="requester"),
        UserRole(sub="usr_mgr", role="manager"),
        UserRole(sub="usr_owner", role="resource_owner"),
        UserRole(sub="usr_risk", role="risk_reviewer"),
    ]
    res = Resource(
        id="engineering.csv",
        name="Engineering Project Artifacts",
        kind="dataset",
        tier="INTERNAL_SYNTHETIC",
        owner_sub="usr_owner",
        allowed_actions=[
            {"name": "view_metadata", "risk_weight": 1},
            {"name": "read_sample", "risk_weight": 1},
            {"name": "read_full", "risk_weight": 3},
            {"name": "query", "risk_weight": 2},
        ],
        active=True,
    )
    session.add_all(users + roles + [res])
    session.commit()
    return session, policy


@pytest.mark.ec("EC-E2E-ACCESS-REQUEST")
def test_full_access_request_lifecycle(e2e_setup):
    session, policy = e2e_setup
    now = datetime(2026, 11, 1, 10, 0, 0, tzinfo=timezone.utc)

    # 1. Requester submits access request
    req = RequestsService.submit_request(
        db=session,
        policy=policy,
        requester_sub="usr_dev",
        resource_id="engineering.csv",
        purpose_code="MODEL_EVALUATION",
        purpose_text="Quarterly development telemetry audit and model benchmarking.",
        actions=["view_metadata", "read_sample", "query"],
        duration_minutes=120,
        risk_controls=["activity_logging", "synthetic_data_only"],
        now=now,
    )
    session.commit()

    assert req.status == RequestStatus.IN_REVIEW.value
    assert len(req.slots) == 3  # manager, resource_owner, risk_reviewer
    slot_roles = {s.slot_role: s for s in req.slots}
    assert "manager" in slot_roles
    assert "resource_owner" in slot_roles
    assert "risk_reviewer" in slot_roles

    # 2. Manager approves
    mgr_slot = slot_roles["manager"]
    req, mgr_slot, grant = ReviewsService.record_decision(
        db=session,
        request_id=req.id,
        slot_id=mgr_slot.id,
        decision="approve",
        reviewer_sub="usr_mgr",
        rationale="Approved business need for quarterly benchmark.",
        now=now,
    )
    session.commit()
    assert mgr_slot.status == SlotStatus.APPROVED.value
    assert grant is None  # Partial approval -> no grant yet (SG-5)

    # 3. Resource owner narrows scope (removes view_metadata, cuts duration to 60m)
    owner_slot = slot_roles["resource_owner"]
    req, owner_slot, grant = ReviewsService.record_decision(
        db=session,
        request_id=req.id,
        slot_id=owner_slot.id,
        decision="narrow",
        reviewer_sub="usr_owner",
        approved_limits={
            "actions": ["read_sample", "query"],
            "duration_minutes": 60,
        },
        rationale="Restricted: removed metadata inspection and reduced to 1h window.",
        now=now,
    )
    session.commit()
    assert owner_slot.status == SlotStatus.NARROWED.value
    assert grant is None

    # 4. Risk reviewer approves
    risk_slot = slot_roles["risk_reviewer"]
    req, risk_slot, grant = ReviewsService.record_decision(
        db=session,
        request_id=req.id,
        slot_id=risk_slot.id,
        decision="approve",
        reviewer_sub="usr_risk",
        rationale="Security controls verified.",
        now=now,
    )
    session.commit()

    # 5. Verify grant is minted with merged limits (SG-6)
    assert req.status == RequestStatus.APPROVED.value
    assert grant is not None
    assert grant.status == GrantStatus.ACTIVE.value
    assert set(grant.actions) == {"read_sample", "query"}
    exp = grant.expires_at if grant.expires_at.tzinfo else grant.expires_at.replace(tzinfo=timezone.utc)
    assert exp == now + timedelta(minutes=60)

    # 6. Gateway PDP Evaluation: Allowed action
    res_allow = SimulationGateway.invoke(
        db=session,
        resource_id="engineering.csv",
        action="query",
        declared_purpose="MODEL_EVALUATION",
        caller_sub="usr_dev",
        input_data={"prompt": "Select active metrics"},
        now=now + timedelta(minutes=10),
    )
    assert res_allow["decision"]["allow"] is True
    assert "output" in res_allow

    # 7. Gateway PDP Evaluation: Narrowed-out action must DENY (SG-6, EC-P02)
    res_deny_action = SimulationGateway.invoke(
        db=session,
        resource_id="engineering.csv",
        action="view_metadata",
        declared_purpose="MODEL_EVALUATION",
        caller_sub="usr_dev",
        input_data={},
        now=now + timedelta(minutes=10),
    )
    assert res_deny_action["decision"]["allow"] is False
    assert res_deny_action["decision"]["code"] == "DENY_ACTION_NOT_GRANTED"

    # 8. Revocation overrides expiry immediately (SG-4)
    GrantsService.revoke_grant(
        db=session,
        policy=policy,
        grant_id=grant.id,
        revoker_sub="usr_owner",
        reason_code="POLICY_VIOLATION",
        emergency=False,
        note="Emergency audit completed early.",
        now=now + timedelta(minutes=15),
    )
    session.commit()

    # 9. Next invocation immediately denies with DENY_REVOKED
    res_after_revoke = SimulationGateway.invoke(
        db=session,
        resource_id="engineering.csv",
        action="query",
        declared_purpose="MODEL_EVALUATION",
        caller_sub="usr_dev",
        input_data={},
        now=now + timedelta(minutes=16),
    )
    assert res_after_revoke["decision"]["allow"] is False
    assert res_after_revoke["decision"]["code"] == "DENY_REVOKED"
