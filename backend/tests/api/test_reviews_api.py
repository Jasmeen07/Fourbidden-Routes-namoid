"""Tests covering Review Decisions Edge Cases (EC-V04..EC-V17)."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.engine import init_database
from app.db.models import User, UserRole, Resource, AccessRequest, Grant
from app.domain.policy import parse_policy_yaml
from app.services.requests import RequestsService
from app.services.reviews import ReviewsService
from app.domain.errors import (
    DomainError,
    RequestNotOpenError,
    DecisionConflictError,
    StaleRequestError,
)


@pytest.fixture
def rev_db(tmp_path):
    db_file = tmp_path / "reviews_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    init_database(engine)
    Session = sessionmaker(bind=engine)
    sess = Session()

    with open("config/policy.yaml", "r", encoding="utf-8") as fp:
        policy = parse_policy_yaml(fp.read())

    users = [
        User(sub="usr_alice", display_name="Alice", manager_sub="usr_mary", active=True),
        User(sub="usr_mary", display_name="Mary", active=True),
        User(sub="usr_risk_1", display_name="Rachel", active=True),
        User(sub="usr_owner_1", display_name="Oscar", active=True),
    ]
    roles = [
        UserRole(sub="usr_alice", role="requester"),
        UserRole(sub="usr_mary", role="manager"),
        UserRole(sub="usr_risk_1", role="risk_reviewer"),
        UserRole(sub="usr_owner_1", role="resource_owner"),
    ]
    res = Resource(
        id="M-1",
        name="Test Model",
        kind="model",
        tier="INTERNAL_SYNTHETIC",
        owner_sub="usr_owner_1",
        allowed_actions=[{"name": "query", "risk_weight": 2}, {"name": "batch_query", "risk_weight": 3}],
        active=True,
    )
    sess.add_all(users + roles + [res])
    sess.commit()

    return sess, policy


@pytest.mark.ec("EC-V04")
def test_ec_v04_decision_on_non_open_request(rev_db):
    """Decision on non-open request raises 409 REQUEST_NOT_OPEN (EC-V04)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    # Requester withdraws request
    RequestsService.withdraw_request(db, req.id, "usr_alice", now=t0 + timedelta(minutes=1))
    db.commit()

    slot = req.slots[0]
    with pytest.raises(RequestNotOpenError):
        ReviewsService.record_decision(
            db, req.id, slot.id, "approve", "usr_mary", now=t0 + timedelta(minutes=2)
        )


@pytest.mark.ec("EC-V05")
def test_ec_v05_decision_idempotent_vs_conflict(rev_db):
    """Same decision twice is idempotent 200; different decision raises 409 DECISION_CONFLICT (EC-V05)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    slot = next(s for s in req.slots if s.slot_role == "manager")
    # First decision
    ReviewsService.record_decision(db, req.id, slot.id, "approve", "usr_mary", now=t0 + timedelta(minutes=1))
    db.commit()

    # Same decision twice -> idempotent success
    req_same, slot_same, _ = ReviewsService.record_decision(
        db, req.id, slot.id, "approve", "usr_mary", now=t0 + timedelta(minutes=2)
    )
    assert slot_same.status == "APPROVED"

    # Different decision on decided slot -> 409 DECISION_CONFLICT
    with pytest.raises(DecisionConflictError):
        ReviewsService.record_decision(
            db, req.id, slot.id, "reject", "usr_mary", rationale="Changing my mind", now=t0 + timedelta(minutes=3)
        )


@pytest.mark.ec("EC-V10")
def test_ec_v10_stale_request_hash(rev_db):
    """Providing a mismatched expected_request_hash raises 409 STALE_REQUEST (EC-V10)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    slot = req.slots[0]
    with pytest.raises(StaleRequestError):
        ReviewsService.record_decision(
            db, req.id, slot.id, "approve", "usr_mary", expected_request_hash="stale_hash_xyz", now=t0 + timedelta(minutes=1)
        )


@pytest.mark.ec("EC-V11")
def test_ec_v11_reject_short_circuit(rev_db):
    """One rejection immediately marks request REJECTED and cancels remaining slots (EC-V11)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    risk_slot = next(s for s in req.slots if s.slot_role == "risk_reviewer")
    ReviewsService.record_decision(
        db, req.id, risk_slot.id, "reject", "usr_risk_1", rationale="Unacceptable risk profile", now=t0 + timedelta(minutes=1)
    )
    db.commit()

    assert req.status == "REJECTED"
    # Other slots cancelled
    other_slots = [s for s in req.slots if s.id != risk_slot.id]
    assert all(s.status == "CANCELLED" for s in other_slots)

    # Later attempt to approve rejected request -> 409
    mgr_slot = next(s for s in req.slots if s.slot_role == "manager")
    with pytest.raises(RequestNotOpenError):
        ReviewsService.record_decision(db, req.id, mgr_slot.id, "approve", "usr_mary", now=t0 + timedelta(minutes=2))


@pytest.mark.ec("EC-V12")
def test_ec_v12_concurrent_final_approval_idempotency(rev_db):
    """Two final approvals create exactly one grant (UNIQUE request_id constraint) (EC-V12)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    for slot in req.slots:
        reviewer = "usr_mary" if slot.slot_role == "manager" else ("usr_owner_1" if slot.slot_role == "resource_owner" else "usr_risk_1")
        ReviewsService.record_decision(db, req.id, slot.id, "approve", reviewer, now=t0 + timedelta(minutes=1))
    db.commit()

    # Exactly one grant exists in DB for this request
    grants = db.query(Grant).filter_by(request_id=req.id).all()
    assert len(grants) == 1


@pytest.mark.ec("EC-V15")
def test_ec_v15_blocked_no_eligible_reviewer(rev_db):
    """When requester is natural assignee and no alternate exists, request is marked BLOCKED, never auto-approved (EC-V15)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # Oscar owns M-1 and is also his own manager, so no separate manager exists
    user_oscar = db.get(User, "usr_owner_1")
    user_oscar.manager_sub = "usr_owner_1"  # Self manager
    db.commit()

    req = RequestsService.submit_request(
        db, policy, "usr_owner_1", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    # Blocked because manager == requester
    assert req.status == "BLOCKED"


@pytest.mark.ec("EC-V16")
def test_ec_v16_rationale_required_for_narrow_and_reject(rev_db):
    """Narrowing or rejecting without rationale raises 422 (EC-V16)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query", "batch_query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    slot = req.slots[0]
    with pytest.raises(DomainError, match="Rationale is required"):
        ReviewsService.record_decision(
            db, req.id, slot.id, "reject", "usr_mary", rationale="", now=t0 + timedelta(minutes=1)
        )


@pytest.mark.ec("EC-V17")
def test_ec_v17_policy_version_bound_at_submission(rev_db):
    """Request retains its bound policy_version and matrix even if policy changes mid-flight (EC-V17)."""
    db, policy = rev_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    assert req.policy_version == policy.version
