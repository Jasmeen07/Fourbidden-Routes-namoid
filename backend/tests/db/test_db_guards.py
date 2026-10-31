"""Tests for database-level triggers and immutability guards (BLUEPRINT §6.9)."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import DBAPIError
from app.db.models import Base, User, Resource, AccessRequest, ReviewSlot, Grant, AuditEvent
from app.db.engine import init_database
from app.domain.hashing import GENESIS_HASH


@pytest.fixture
def db_session(tmp_path):
    """Creates a temporary SQLite database with all tables and triggers."""
    db_file = tmp_path / "test_guards.db"
    test_engine = create_engine(f"sqlite:///{db_file}")
    init_database(test_engine)

    Session = sessionmaker(bind=test_engine)
    session = Session()

    # Seed minimal base entities for test rows
    user = User(sub="usr_alice", display_name="Alice", email="alice@test.com", active=True)
    res = Resource(
        id="M-1",
        name="Test Model",
        kind="model",
        tier="INTERNAL_SYNTHETIC",
        owner_sub="usr_alice",
        allowed_actions=[{"name": "query", "risk_weight": 1}],
        active=True,
    )
    session.add_all([user, res])
    session.commit()

    yield session
    session.close()


@pytest.mark.ec("EC-L01")
def test_guard_audit_no_update_or_delete(db_session):
    """Raw SQL UPDATE or DELETE on audit_events must be aborted by trigger (EC-L01)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    event = AuditEvent(
        id="evt-1",
        ts=now,
        type="REQUEST_SUBMITTED",
        actor_sub="usr_alice",
        actor_role="requester",
        subject_type="request",
        subject_id="req-1",
        payload={"action": "test"},
        prev_hash=GENESIS_HASH,
        hash="abcd" * 16,
    )
    db_session.add(event)
    db_session.commit()

    # Attempt UPDATE
    with pytest.raises(DBAPIError, match="audit is append-only"):
        db_session.connection().exec_driver_sql("UPDATE audit_events SET type = 'TAMPERED' WHERE id = 'evt-1'")
    db_session.rollback()

    # Attempt DELETE
    with pytest.raises(DBAPIError, match="audit is append-only"):
        db_session.connection().exec_driver_sql("DELETE FROM audit_events WHERE id = 'evt-1'")
    db_session.rollback()


@pytest.mark.ec("EC-G01")
def test_guard_grant_requires_approved_request(db_session):
    """Direct SQL insert of a grant for a non-approved request must abort (EC-G01)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    req = AccessRequest(
        id="req-open",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Audit text",
        actions=["query"],
        duration_minutes=30,
        risk_controls=["activity_logging"],
        status="IN_REVIEW",  # Not APPROVED
        policy_version=1,
        content_hash="hash1",
        created_at=now,
    )
    db_session.add(req)
    db_session.commit()

    # Attempt inserting grant for non-approved request
    with pytest.raises(DBAPIError, match="request not approved"):
        db_session.connection().exec_driver_sql(
            """
            INSERT INTO grants (id, request_id, requester_sub, resource_id, purpose_code, actions, activated_at, expires_at, status, revoke_emergency)
            VALUES ('g-1', 'req-open', 'usr_alice', 'M-1', 'BIAS_AUDIT', '["query"]', '2026-10-31 12:00:00', '2026-10-31 12:30:00', 'ACTIVE', 0)
            """
        )
    db_session.rollback()


@pytest.mark.ec("EC-G02")
def test_guard_grant_scope_immutable(db_session):
    """Direct update of grant expires_at / actions / purpose must abort (EC-G02)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    req = AccessRequest(
        id="req-appr",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Audit text",
        actions=["query"],
        duration_minutes=30,
        risk_controls=["activity_logging"],
        status="APPROVED",
        policy_version=1,
        content_hash="hash1",
        created_at=now,
    )
    db_session.add(req)
    db_session.commit()

    grant = Grant(
        id="g-1",
        request_id="req-appr",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=["query"],
        activated_at=now,
        expires_at=now + timedelta(minutes=30),
        status="ACTIVE",
        revoke_emergency=False,
    )
    db_session.add(grant)
    db_session.commit()

    # Attempt updating expires_at (silent extension attempt)
    with pytest.raises(DBAPIError, match="grant scope is immutable"):
        db_session.connection().exec_driver_sql("UPDATE grants SET expires_at = '2099-01-01 00:00:00' WHERE id = 'g-1'")
    db_session.rollback()

    # Attempt updating actions
    with pytest.raises(DBAPIError, match="grant scope is immutable"):
        db_session.connection().exec_driver_sql("UPDATE grants SET actions = '[\"query\", \"batch_query\"]' WHERE id = 'g-1'")
    db_session.rollback()


def test_guard_grant_terminal_states(db_session):
    """Terminal grant status cannot be reversed."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    req = AccessRequest(
        id="req-term",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Audit text",
        actions=["query"],
        duration_minutes=30,
        risk_controls=["activity_logging"],
        status="APPROVED",
        policy_version=1,
        content_hash="hash1",
        created_at=now,
    )
    db_session.add(req)
    db_session.commit()

    grant = Grant(
        id="g-term",
        request_id="req-term",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=["query"],
        activated_at=now,
        expires_at=now + timedelta(minutes=30),
        status="REVOKED",
        revoked_at=now,
        revoke_emergency=False,
    )
    db_session.add(grant)
    db_session.commit()

    # Attempt reversing REVOKED to ACTIVE
    with pytest.raises(DBAPIError, match="terminal grant state"):
        db_session.connection().exec_driver_sql("UPDATE grants SET status = 'ACTIVE' WHERE id = 'g-term'")
    db_session.rollback()


@pytest.mark.ec("EC-R08")
def test_guard_request_content_immutable(db_session):
    """Attempting to alter a submitted request via SQL must abort (EC-R08)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    req = AccessRequest(
        id="req-immut",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        purpose_text="Audit text",
        actions=["query"],
        duration_minutes=30,
        risk_controls=["activity_logging"],
        status="IN_REVIEW",
        policy_version=1,
        content_hash="hash1",
        created_at=now,
    )
    db_session.add(req)
    db_session.commit()

    # Attempt altering actions
    with pytest.raises(DBAPIError, match="request content is immutable"):
        db_session.connection().exec_driver_sql("UPDATE access_requests SET actions = '[\"query\", \"admin\"]' WHERE id = 'req-immut'")
    db_session.rollback()

    # But changing status is allowed (per state machine)
    db_session.connection().exec_driver_sql("UPDATE access_requests SET status = 'WITHDRAWN' WHERE id = 'req-immut'")
    db_session.commit()
    r = db_session.get(AccessRequest, "req-immut")
    assert r.status == "WITHDRAWN"
