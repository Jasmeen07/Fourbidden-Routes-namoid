"""Tests covering Request Edge Cases (EC-R01..EC-R12)."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.engine import init_database
from app.db.models import User, UserRole, Resource, AccessRequest, Grant
from app.domain.policy import parse_policy_yaml
from app.services.requests import RequestsService, scan_for_secrets
from app.services.grants import GrantsService
from app.domain.errors import (
    DomainError,
    ControlsMissingError,
    SecretPatternDetectedError,
    DuplicateRequestError,
    GrantAlreadyActiveError,
    RequestNotOpenError,
)


@pytest.fixture
def req_db(tmp_path):
    db_file = tmp_path / "requests_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    init_database(engine)
    Session = sessionmaker(bind=engine)
    sess = Session()

    with open("config/policy.yaml", "r", encoding="utf-8") as fp:
        policy = parse_policy_yaml(fp.read())

    user = User(sub="usr_alice", display_name="Alice", manager_sub="usr_mary", active=True)
    mgr = User(sub="usr_mary", display_name="Mary", active=True)
    owner = User(sub="usr_oscar", display_name="Oscar", active=True)
    risk = User(sub="usr_risk_1", display_name="Rachel", active=True)

    roles = [
        UserRole(sub="usr_alice", role="requester"),
        UserRole(sub="usr_mary", role="manager"),
        UserRole(sub="usr_oscar", role="resource_owner"),
        UserRole(sub="usr_risk_1", role="risk_reviewer"),
    ]

    res = Resource(
        id="M-1",
        name="Test Model",
        kind="model",
        tier="INTERNAL_SYNTHETIC",
        owner_sub="usr_oscar",
        allowed_actions=[{"name": "query", "risk_weight": 2}, {"name": "batch_query", "risk_weight": 3}],
        active=True,
    )
    sess.add_all([user, mgr, owner, risk, res] + roles)
    sess.commit()

    return sess, policy


@pytest.mark.ec("EC-R01")
def test_ec_r01_duration_bounds(req_db):
    """Duration <= 0 or > tier max must raise validation error (EC-R01)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # Duration < min (min is 2)
    with pytest.raises(DomainError, match="Duration must be between"):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose text", ["query"], 1, ["activity_logging", "synthetic_data_only"], now=t0
        )

    # Duration > max tier duration (INTERNAL_SYNTHETIC max is 4320)
    with pytest.raises(DomainError, match="Duration must be between"):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose text", ["query"], 5000, ["activity_logging", "synthetic_data_only"], now=t0
        )


@pytest.mark.ec("EC-R02")
def test_ec_r02_actions_validation(req_db):
    """Empty action set or action not offered by resource raises error (EC-R02)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # Empty actions
    with pytest.raises(DomainError, match="Requested actions must be non-empty"):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose text", [], 30, ["activity_logging", "synthetic_data_only"], now=t0
        )

    # Non-offered action
    with pytest.raises(DomainError, match="Requested actions must be non-empty and offered"):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose text", ["query", "unauthorized_export"], 30, ["activity_logging", "synthetic_data_only"], now=t0
        )


@pytest.mark.ec("EC-R03")
def test_ec_r03_unknown_resource(req_db):
    """Unknown or inactive resource raises 404 validation error (EC-R03)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    with pytest.raises(DomainError, match="Resource 'M-unknown' is not found"):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-unknown", "BIAS_AUDIT", "purpose text", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
        )


@pytest.mark.ec("EC-R04")
def test_ec_r04_missing_risk_controls(req_db):
    """Missing required risk controls for tier raises CONTROLS_MISSING (EC-R04)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # INTERNAL_SYNTHETIC requires both activity_logging and synthetic_data_only
    with pytest.raises(ControlsMissingError):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "purpose text", ["query"], 30, ["activity_logging"], now=t0
        )


@pytest.mark.ec("EC-R05")
def test_ec_r05_secret_pattern_detected(req_db):
    """Free text with secret or token pattern raises SECRET_PATTERN_DETECTED (EC-R05)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    with pytest.raises(SecretPatternDetectedError):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "Here is my secret: password=supersecret123", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
        )


@pytest.mark.ec("EC-R06")
def test_ec_r06_duplicate_open_request(req_db):
    """Duplicate open request for same requester+resource+purpose raises DUPLICATE_REQUEST (EC-R06)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req1 = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "first request", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    with pytest.raises(DuplicateRequestError):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "second duplicate request", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
        )


@pytest.mark.ec("EC-R07")
def test_ec_r07_grant_already_active(req_db):
    """If an active grant already covers the ask, raise GRANT_ALREADY_ACTIVE (EC-R07)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    grant = Grant(
        id="g-active-1",
        request_id="req-prior",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=["query", "batch_query"],
        activated_at=t0,
        expires_at=t0 + timedelta(hours=1),
        status="ACTIVE",
    )
    db.add(grant)
    db.commit()

    with pytest.raises(GrantAlreadyActiveError):
        RequestsService.submit_request(
            db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "already have grant", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
        )


@pytest.mark.ec("EC-R09")
def test_ec_r09_withdraw_request(req_db):
    """Requester can withdraw request while in review, cancelling pending slots (EC-R09)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "request to withdraw", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    withdrawn = RequestsService.withdraw_request(db, req.id, "usr_alice", now=t0 + timedelta(minutes=5))
    db.commit()

    assert withdrawn.status == "WITHDRAWN"
    assert all(s.status == "CANCELLED" for s in withdrawn.slots)


@pytest.mark.ec("EC-R10")
def test_ec_r10_pending_ttl_expired(req_db):
    """Pending TTL exceeded marks request EXPIRED_UNREVIEWED without a grant (EC-R10)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", "stale request", ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    # Advance beyond 72 hours TTL
    t_after = t0 + timedelta(hours=73)
    GrantsService.tick_sweeper(db, policy, now=t_after)
    db.commit()

    assert req.status == "EXPIRED_UNREVIEWED"
    assert all(s.status == "CANCELLED" for s in req.slots)


@pytest.mark.ec("EC-R11")
def test_ec_r11_extra_fields_forbidden():
    """Client sending extra fields like status or grant_id raises 422 (EC-R11)."""
    from pydantic import ValidationError
    from app.api.requests import CreateRequestPayload

    with pytest.raises(ValidationError):
        CreateRequestPayload.model_validate({
            "resource_id": "M-1",
            "purpose_code": "BIAS_AUDIT",
            "purpose_text": "Audit",
            "actions": ["query"],
            "duration_minutes": 30,
            "risk_controls": ["activity_logging"],
            "status": "APPROVED",  # Forbidden extra field!
        })


@pytest.mark.ec("EC-R12")
def test_ec_r12_html_stored_verbatim(req_db):
    """HTML or script tags in text are stored verbatim (and escaped at display time) (EC-R12)."""
    db, policy = req_db
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    raw_text = "Testing <b>bold</b> and <script>alert('xss')</script> input"

    req = RequestsService.submit_request(
        db, policy, "usr_alice", "M-1", "BIAS_AUDIT", raw_text, ["query"], 30, ["activity_logging", "synthetic_data_only"], now=t0
    )
    db.commit()

    assert req.purpose_text == raw_text
