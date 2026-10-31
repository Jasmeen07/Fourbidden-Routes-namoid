"""Tests for AuditService (EC-L02, EC-L04)."""
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.engine import init_database
from app.services.audit import AuditService
from app.domain.errors import DomainError


@pytest.fixture
def session(tmp_path):
    db_file = tmp_path / "test_audit.db"
    engine = create_engine(f"sqlite:///{db_file}")
    init_database(engine)
    Session = sessionmaker(bind=engine)
    sess = Session()
    yield sess
    sess.close()


def test_audit_append_and_verify(session):
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    for i in range(5):
        AuditService.append_event(
            session=session,
            event_type="REQUEST_SUBMITTED",
            subject_type="request",
            subject_id=f"req-{i}",
            payload={"test_index": i},
            actor_sub="usr_alice",
            actor_role="requester",
            now=now,
        )
    session.commit()

    res = AuditService.verify_chain(session)
    assert res["ok"] is True
    assert res["checked"] == 5
    assert res["first_bad_seq"] is None


@pytest.mark.ec("EC-L04")
def test_audit_rejects_emails_and_tokens(session):
    """Payloads containing emails, passwords, or tokens are rejected (EC-L04)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)

    # Email in payload
    with pytest.raises(DomainError, match="Sensitive data pattern"):
        AuditService.append_event(
            session=session,
            event_type="AUTH_LOGIN",
            subject_type="user",
            subject_id="usr_alice",
            payload={"user_email": "alice@example.com"},
            now=now,
        )

    # Token in payload
    with pytest.raises(DomainError, match="Forbidden sensitive key"):
        AuditService.append_event(
            session=session,
            event_type="AUTH_LOGIN",
            subject_type="user",
            subject_id="usr_alice",
            payload={"access_token": "secret_abc_123"},
            now=now,
        )
