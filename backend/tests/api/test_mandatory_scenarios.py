"""The Four Mandatory Challenge Tests matching BLUEPRINT §10.4."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.models import User, UserRole, Resource, AccessRequest, Grant, AuditEvent
from app.db.engine import init_database
from app.domain.policy import parse_policy_yaml
from app.services.requests import RequestsService
from app.services.reviews import ReviewsService
from app.services.grants import GrantsService
from app.services.gateway import SimulationGateway
from app.domain.errors import SodSelfReviewError, SodDualSlotError


@pytest.fixture
def test_setup(tmp_path):
    """Sets up a clean test DB, seeded users, resources, and policy."""
    db_file = tmp_path / "mandatory_tests.db"
    engine = create_engine(f"sqlite:///{db_file}")
    init_database(engine)

    Session = sessionmaker(bind=engine)
    session = Session()

    # Load policy
    with open("config/policy.yaml", "r", encoding="utf-8") as fp:
        policy = parse_policy_yaml(fp.read())

    # Seed users
    users = [
        User(sub="usr_req_a", display_name="Alice Requester", email="alice@test.com", manager_sub="usr_mgr_1", active=True),
        User(sub="usr_req_b", display_name="Bob DualRole", email="bob@test.com", manager_sub="usr_mgr_1", active=True),
        User(sub="usr_mgr_1", display_name="Mary Manager", email="mary@test.com", active=True),
        User(sub="usr_risk_1", display_name="Rachel RiskReviewer", email="rachel@test.com", active=True),
        User(sub="usr_owner_1", display_name="Oscar ResourceOwner", email="oscar@test.com", active=True),
        User(sub="usr_risk_2", display_name="Rita AlternateRisk", email="rita@test.com", active=True),
    ]
    roles = [
        UserRole(sub="usr_req_a", role="requester"),
        UserRole(sub="usr_req_b", role="requester"),
        UserRole(sub="usr_req_b", role="risk_reviewer"),  # Bob has both requester & risk_reviewer!
        UserRole(sub="usr_mgr_1", role="manager"),
        UserRole(sub="usr_risk_1", role="risk_reviewer"),
        UserRole(sub="usr_owner_1", role="resource_owner"),
        UserRole(sub="usr_risk_2", role="risk_reviewer"),
    ]
    resources = [
        Resource(
            id="M-sentiment-v1",
            name="Sentiment Model",
            kind="model",
            tier="INTERNAL_SYNTHETIC",
            owner_sub="usr_owner_1",
            allowed_actions=[{"name": "query", "risk_weight": 2}, {"name": "batch_query", "risk_weight": 3}],
            active=True,
        ),
        Resource(
            id="D-claims-synth",
            name="Claims Dataset",
            kind="dataset",
            tier="RESTRICTED_SYNTHETIC",
            owner_sub="usr_owner_1",
            allowed_actions=[
                {"name": "read_sample", "risk_weight": 2},
                {"name": "read_full", "risk_weight": 5},
                {"name": "export_masked", "risk_weight": 7},
            ],
            active=True,
        )
    ]
    session.add_all(users)
    session.add_all(roles)
    session.add_all(resources)
    session.commit()

    return session, policy


# ============================================================================
# Mandatory Test 1: Separation of Duties (§10.4.1, SUB-5)
# ============================================================================

@pytest.mark.ec("EC-V01")
@pytest.mark.ec("EC-V02")
def test_separation_of_duties(test_setup):
    """
    Challenge Mandatory Test 1:
    (a) Requester with risk_reviewer role calls decision API on own request -> 403 SOD_SELF_REVIEW
    (b) One user assigned owner+manager cannot decide both
    (c) A different eligible user is assigned and succeeds
    (d) All attempts audited
    """
    db, policy = test_setup
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # Bob (who is both requester and risk_reviewer) submits a request
    req = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub="usr_req_b",
        resource_id="M-sentiment-v1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Testing dual role self approval prevention",
        actions=["query"],
        duration_minutes=30,
        risk_controls=["activity_logging", "synthetic_data_only"],
        now=t0,
    )
    db.commit()

    # Find risk slot on request
    risk_slot = next(s for s in req.slots if s.slot_role == "risk_reviewer")

    # (a) Requester Bob tries to decide on his own request -> 403 SOD_SELF_REVIEW
    with pytest.raises(SodSelfReviewError):
        ReviewsService.record_decision(
            db=db,
            request_id=req.id,
            slot_id=risk_slot.id,
            decision="approve",
            reviewer_sub="usr_req_b",
            now=t0,
        )

    # (d) Verify security tamper attempt event was logged in audit
    tamper_event = db.query(AuditEvent).filter_by(type="SECURITY_TAMPER_ATTEMPT").first()
    assert tamper_event is not None
    assert tamper_event.actor_sub == "usr_req_b"
    assert tamper_event.payload["attempt"] == "self_review"

    # (b) Create a scenario where one reviewer tries to decide two slots
    # Manager Mary approves manager slot
    mgr_slot = next(s for s in req.slots if s.slot_role == "manager")
    ReviewsService.record_decision(
        db=db,
        request_id=req.id,
        slot_id=mgr_slot.id,
        decision="approve",
        reviewer_sub="usr_mgr_1",
        now=t0 + timedelta(minutes=1),
    )
    db.commit()

    # Add resource_owner role to Mary and simulate Mary trying to decide owner slot too (dual-slot)
    db.add(UserRole(sub="usr_mgr_1", role="resource_owner"))
    db.commit()
    owner_slot = next(s for s in req.slots if s.slot_role == "resource_owner")
    with pytest.raises(SodDualSlotError):
        ReviewsService.record_decision(
            db=db,
            request_id=req.id,
            slot_id=owner_slot.id,
            decision="approve",
            reviewer_sub="usr_mgr_1",
            now=t0 + timedelta(minutes=2),
        )
    db.rollback()

    # (c) The natural resource owner (Oscar) decides and succeeds
    ReviewsService.record_decision(
        db=db,
        request_id=req.id,
        slot_id=owner_slot.id,
        decision="approve",
        reviewer_sub="usr_owner_1",
        now=t0 + timedelta(minutes=3),
    )
    db.commit()

    # Different eligible risk reviewer (Rachel) decides and succeeds
    req_updated, slot_updated, grant = ReviewsService.record_decision(
        db=db,
        request_id=req.id,
        slot_id=risk_slot.id,
        decision="approve",
        reviewer_sub="usr_risk_1",
        now=t0 + timedelta(minutes=4),
    )
    db.commit()

    # Grant activated only after all separate approvals
    assert grant is not None
    assert grant.requester_sub == "usr_req_b"
    assert grant.status == "ACTIVE"


# ============================================================================
# Mandatory Test 2: Expiry (§10.4.2, SUB-5)
# ============================================================================

@pytest.mark.ec("EC-G05")
@pytest.mark.ec("EC-G06")
@pytest.mark.ec("EC-G07")
def test_expiry(test_setup):
    """
    Challenge Mandatory Test 2:
    Grant of 2 min; at T+1:59.999 invoke allowed; at T+2:00.000 denied DENY_EXPIRED;
    with sweeper disabled still denied; sweeper later records one GRANT_EXPIRED;
    history shows it.
    """
    db, policy = test_setup
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Create a 2-minute request and approve it
    req = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub="usr_req_a",
        resource_id="M-sentiment-v1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Testing precise expiry boundary",
        actions=["query"],
        duration_minutes=2,  # Exactly 2 minutes
        risk_controls=["activity_logging", "synthetic_data_only"],
        now=t0,
    )
    db.commit()

    # Approve all slots
    for slot in req.slots:
        reviewer = "usr_mgr_1" if slot.slot_role == "manager" else ("usr_owner_1" if slot.slot_role == "resource_owner" else "usr_risk_1")
        ReviewsService.record_decision(
            db=db,
            request_id=req.id,
            slot_id=slot.id,
            decision="approve",
            reviewer_sub=reviewer,
            now=t0 + timedelta(seconds=1),
        )
    db.commit()

    grant = db.query(Grant).filter_by(request_id=req.id).one()
    expires_at = grant.expires_at

    # At T + 1:59.999 (1 millisecond before expiry) -> invoke ALLOW
    t_before = expires_at - timedelta(milliseconds=1)
    res_before = SimulationGateway.invoke(
        db=db,
        resource_id="M-sentiment-v1",
        action="query",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=t_before,
    )
    assert res_before["decision"]["allow"] is True
    assert res_before["output"] is not None
    assert "MOCK" in str(res_before["output"])

    # At T + 2:00.000 (exactly at expiry boundary) -> DENY_EXPIRED (strict now < expires_at)
    res_exact = SimulationGateway.invoke(
        db=db,
        resource_id="M-sentiment-v1",
        action="query",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=expires_at,
    )
    assert res_exact["decision"]["allow"] is False
    assert res_exact["decision"]["code"] == "DENY_EXPIRED"

    # With sweeper disabled, PDP still denies and effective status shows EXPIRED (derived authority, EC-G06)
    assert grant.status == "ACTIVE"  # DB status hasn't been swept yet!
    assert GrantsService.get_grant_with_effective_status(grant, expires_at + timedelta(seconds=5))["status"] == "EXPIRED"

    # Sweeper runs later and records one GRANT_EXPIRED event (EC-G07)
    expired_count = GrantsService.tick_sweeper(db, policy, now=expires_at + timedelta(seconds=10))
    db.commit()
    assert expired_count == 1
    assert grant.status == "EXPIRED"

    # Sweeper runs a second time -> idempotent 0 events
    expired_count_2 = GrantsService.tick_sweeper(db, policy, now=expires_at + timedelta(seconds=15))
    assert expired_count_2 == 0

    # History shows GRANT_EXPIRED event
    expired_events = db.query(AuditEvent).filter_by(subject_id=grant.id, type="GRANT_EXPIRED").all()
    assert len(expired_events) == 1


# ============================================================================
# Mandatory Test 3: Narrowed Scope (§10.4.3, SUB-5)
# ============================================================================

@pytest.mark.ec("EC-V06")
@pytest.mark.ec("EC-P02")
def test_narrowed_scope(test_setup):
    """
    Challenge Mandatory Test 3:
    Request [query, batch_query] 60 min; manager approves, risk narrows to [query] 30 min;
    resource owner approves -> grant is exactly [query], 30 min;
    batch_query -> DENY_ACTION_NOT_GRANTED; at 31 min -> DENY_EXPIRED;
    the merged limits and who narrowed are in history.
    """
    db, policy = test_setup
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Submit request with [query, batch_query] for 60 min
    req = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub="usr_req_a",
        resource_id="M-sentiment-v1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Requesting full queries for evaluation",
        actions=["query", "batch_query"],
        duration_minutes=60,
        risk_controls=["activity_logging", "synthetic_data_only"],
        now=t0,
    )
    db.commit()

    # Manager approves full request
    mgr_slot = next(s for s in req.slots if s.slot_role == "manager")
    ReviewsService.record_decision(
        db=db,
        request_id=req.id,
        slot_id=mgr_slot.id,
        decision="approve",
        reviewer_sub="usr_mgr_1",
        now=t0 + timedelta(minutes=1),
    )
    db.commit()

    # Risk reviewer NARROWS to [query] only, 30 minutes
    risk_slot = next(s for s in req.slots if s.slot_role == "risk_reviewer")
    ReviewsService.record_decision(
        db=db,
        request_id=req.id,
        slot_id=risk_slot.id,
        decision="narrow",
        reviewer_sub="usr_risk_1",
        approved_limits={"actions": ["query"], "duration_minutes": 30},
        rationale="Dropping batch_query to minimize bulk export risk",
        now=t0 + timedelta(minutes=2),
    )
    db.commit()

    # Resource owner approves
    owner_slot = next(s for s in req.slots if s.slot_role == "resource_owner")
    _, _, grant = ReviewsService.record_decision(
        db=db,
        request_id=req.id,
        slot_id=owner_slot.id,
        decision="approve",
        reviewer_sub="usr_owner_1",
        now=t0 + timedelta(minutes=3),
    )
    db.commit()

    # Grant actions are strictly the narrowed actions [query], and duration is 30m
    assert grant is not None
    assert grant.actions == ["query"]
    assert int((grant.expires_at - grant.activated_at).total_seconds() / 60) == 30

    # 2. Invoke granted action [query] at T+10m -> ALLOW
    res_query = SimulationGateway.invoke(
        db=db,
        resource_id="M-sentiment-v1",
        action="query",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=t0 + timedelta(minutes=10),
    )
    assert res_query["decision"]["allow"] is True

    # 3. Invoke dropped action [batch_query] at T+10m -> DENY_ACTION_NOT_GRANTED
    res_batch = SimulationGateway.invoke(
        db=db,
        resource_id="M-sentiment-v1",
        action="batch_query",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=t0 + timedelta(minutes=10),
    )
    assert res_batch["decision"]["allow"] is False
    assert res_batch["decision"]["code"] == "DENY_ACTION_NOT_GRANTED"

    # 4. At 31 min (past narrowed 30 min duration) -> DENY_EXPIRED
    res_expired = SimulationGateway.invoke(
        db=db,
        resource_id="M-sentiment-v1",
        action="query",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=grant.activated_at + timedelta(minutes=31),
    )
    assert res_expired["decision"]["allow"] is False
    assert res_expired["decision"]["code"] == "DENY_EXPIRED"

    # Verify decision history records who narrowed and the approved limits
    narrow_event = db.query(AuditEvent).filter_by(type="DECISION_NARROWED").first()
    assert narrow_event is not None
    assert narrow_event.actor_sub == "usr_risk_1"
    assert narrow_event.payload["approved_limits"]["actions"] == ["query"]


# ============================================================================
# Mandatory Test 4: Emergency Revocation (§10.4.4, SUB-5)
# ============================================================================

@pytest.mark.ec("EC-G08")
@pytest.mark.ec("EC-G09")
@pytest.mark.ec("EC-G16")
def test_emergency_revocation(test_setup):
    """
    Challenge Mandatory Test 4:
    Active grant with 24 h left; risk reviewer revokes with emergency=true + reason;
    next invoke denied DENY_REVOKED (< 1 s); original expiry unchanged but irrelevant;
    requester's session still valid; second revoke idempotent;
    notifications created; event flagged emergency.
    """
    db, policy = test_setup
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Create a 24-hour grant on claims dataset
    req = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub="usr_req_a",
        resource_id="D-claims-synth",
        purpose_code="BIAS_AUDIT",
        purpose_text="Red-team simulated evaluation",
        actions=["read_sample", "read_full"],
        duration_minutes=1440,  # 24 hours
        risk_controls=["activity_logging", "synthetic_data_only", "isolated_workspace"],
        now=t0,
    )
    db.commit()

    for slot in req.slots:
        reviewer = "usr_mgr_1" if slot.slot_role == "manager" else ("usr_owner_1" if slot.slot_role == "resource_owner" else "usr_risk_1")
        ReviewsService.record_decision(
            db=db,
            request_id=req.id,
            slot_id=slot.id,
            decision="approve",
            reviewer_sub=reviewer,
            now=t0 + timedelta(seconds=1),
        )
    db.commit()

    grant = db.query(Grant).filter_by(request_id=req.id).one()
    assert grant.status == "ACTIVE"
    orig_expiry = grant.expires_at

    # Invoke is allowed initially
    res_init = SimulationGateway.invoke(
        db=db,
        resource_id="D-claims-synth",
        action="read_sample",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=t0 + timedelta(minutes=5),
    )
    assert res_init["decision"]["allow"] is True

    # 2. Risk reviewer issues an EMERGENCY REVOCATION
    revoked_grant = GrantsService.revoke_grant(
        db=db,
        policy=policy,
        grant_id=grant.id,
        revoker_sub="usr_risk_1",
        reason_code="SECURITY_INCIDENT",
        emergency=True,
        note="Suspected anomalous extraction pattern detected",
        now=t0 + timedelta(minutes=10),
    )
    db.commit()

    # Original expiry is immutable
    assert revoked_grant.expires_at == orig_expiry
    assert revoked_grant.revoked_at is not None
    assert revoked_grant.revoke_emergency is True

    # 3. Next invoke is denied DENY_REVOKED immediately (< 1 s)
    res_after = SimulationGateway.invoke(
        db=db,
        resource_id="D-claims-synth",
        action="read_sample",
        declared_purpose="BIAS_AUDIT",
        caller_sub="usr_req_a",
        now=t0 + timedelta(minutes=10, seconds=1),
    )
    assert res_after["decision"]["allow"] is False
    assert res_after["decision"]["code"] == "DENY_REVOKED"

    # 4. Second revoke is idempotent 200 without error or duplicate event (EC-G09)
    GrantsService.revoke_grant(
        db=db,
        policy=policy,
        grant_id=grant.id,
        revoker_sub="usr_risk_1",
        reason_code="SECURITY_INCIDENT",
        emergency=True,
        now=t0 + timedelta(minutes=11),
    )
    db.commit()

    # 5. Check audit event is flagged emergency
    revoke_events = db.query(AuditEvent).filter_by(subject_id=grant.id, type="GRANT_REVOKED").all()
    assert len(revoke_events) == 1
    assert revoke_events[0].payload["emergency"] is True
    assert revoke_events[0].payload["reason_code"] == "SECURITY_INCIDENT"
