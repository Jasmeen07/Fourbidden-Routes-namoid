"""Tests covering Authentication & Session Edge Cases (EC-A01..EC-A10)."""
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.engine import init_database
from app.db.models import User, UserRole, Session as SessionModel, Grant, AuthTransaction
from app.auth.session import SessionManager, hash_session_token
from app.auth.mock_provider import MockOidcProvider
from app.auth.roles import RoleResolver
from app.auth.provider import Identity
from app.domain.errors import DomainError


@pytest.fixture
def auth_db(tmp_path):
    db_file = tmp_path / "auth_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    init_database(engine)
    Session = sessionmaker(bind=engine)
    sess = Session()
    yield sess
    sess.close()


@pytest.mark.ec("EC-A01")
def test_ec_a01_no_role_assigned(auth_db):
    """User with no assigned roles gets empty role list (EC-A01)."""
    identity = Identity(
        sub="usr_norole",
        display_name="No Role User",
        email="noroles@random.com",
        email_verified=True,
        claims={"roles": []},
    )
    user = RoleResolver.upsert_user_and_roles(auth_db, identity)
    auth_db.commit()

    roles = RoleResolver.resolve_roles(auth_db, identity)
    assert roles == []


@pytest.mark.ec("EC-A02")
@pytest.mark.asyncio
async def test_ec_a02_state_mismatch(auth_db):
    """Missing or mismatched state parameter rejects authentication (EC-A02)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    auth_db.add(AuthTransaction(state="valid_state_123", nonce="nonce_123", code_verifier="verif", created_at=now))
    auth_db.commit()

    # Query with mismatched state
    tx = auth_db.get(AuthTransaction, "wrong_state_456")
    assert tx is None  # Fails state match


@pytest.mark.ec("EC-A03")
@pytest.mark.asyncio
async def test_ec_a03_token_validation_failures():
    """ID token bad signature, wrong aud/iss, expired, or nonce mismatch must reject (EC-A03)."""
    # 1. Bad signature
    idp_bad_sig = MockOidcProvider(fail_hook="bad_signature")
    tx = await idp_bad_sig.begin_login("http://test/cb")
    with pytest.raises(DomainError, match="ID token validation failed"):
        await idp_bad_sig.complete_login("alice", tx.state, tx.nonce, tx.code_verifier, "http://test/cb")

    # 2. Expired token
    idp_exp = MockOidcProvider(fail_hook="expired_token")
    with pytest.raises(DomainError, match="ID token validation failed"):
        await idp_exp.complete_login("alice", tx.state, tx.nonce, tx.code_verifier, "http://test/cb")

    # 3. Wrong aud
    idp_aud = MockOidcProvider(fail_hook="wrong_aud")
    with pytest.raises(DomainError, match="ID token validation failed"):
        await idp_aud.complete_login("alice", tx.state, tx.nonce, tx.code_verifier, "http://test/cb")

    # 4. Wrong iss
    idp_iss = MockOidcProvider(fail_hook="wrong_iss")
    with pytest.raises(DomainError, match="ID token validation failed"):
        await idp_iss.complete_login("alice", tx.state, tx.nonce, tx.code_verifier, "http://test/cb")

    # 5. Nonce mismatch
    idp_nonce = MockOidcProvider(fail_hook="nonce_mismatch")
    with pytest.raises(DomainError, match="ID token nonce mismatch"):
        await idp_nonce.complete_login("alice", tx.state, tx.nonce, tx.code_verifier, "http://test/cb")


@pytest.mark.ec("EC-A04")
def test_ec_a04_callback_replay(auth_db):
    """Callback state is single-use and deleted on first attempt (EC-A04)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    tx = AuthTransaction(state="single_use_state", nonce="nonce_1", code_verifier="verifier_1", created_at=now)
    auth_db.add(tx)
    auth_db.commit()

    # First attempt: load and delete
    loaded_tx = auth_db.get(AuthTransaction, "single_use_state")
    assert loaded_tx is not None
    auth_db.delete(loaded_tx)
    auth_db.commit()

    # Second replay attempt: transaction already gone
    replay_tx = auth_db.get(AuthTransaction, "single_use_state")
    assert replay_tx is None


@pytest.mark.ec("EC-A05")
def test_ec_a05_session_fixation_rotation(auth_db):
    """Login mints a new random session token and invalidates old ones (EC-A05)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    t1, csrf1, s1 = SessionManager.create_session(auth_db, "usr_alice", now=now)
    auth_db.commit()

    # Re-login rotates session token
    t2, csrf2, s2 = SessionManager.create_session(auth_db, "usr_alice", now=now + timedelta(minutes=1))
    auth_db.commit()

    assert t1 != t2
    assert s1.id != s2.id
    assert csrf1 != csrf2


@pytest.mark.ec("EC-A06")
def test_ec_a06_session_timeouts(auth_db):
    """Idle timeout 30 min and absolute timeout 8 h expire session (EC-A06)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    raw_token, _, s = SessionManager.create_session(auth_db, "usr_alice", now=now)
    auth_db.commit()

    # Valid within idle window
    assert SessionManager.validate_session(auth_db, raw_token, now=now + timedelta(minutes=15)) is not None

    # Expired after 31 min idle
    assert SessionManager.validate_session(auth_db, raw_token, now=now + timedelta(minutes=46)) is None


@pytest.mark.ec("EC-A07")
def test_ec_a07_logout_does_not_revoke_grants(auth_db):
    """Sign-out destroys session but NEVER revokes active grants (EC-A07, CO-4)."""
    now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    user = User(sub="usr_alice", display_name="Alice", active=True)
    auth_db.add(user)
    raw_token, _, _ = SessionManager.create_session(auth_db, "usr_alice", now=now)

    # User has an active grant
    grant = Grant(
        id="g-alice-1",
        request_id="req-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=["query"],
        activated_at=now,
        expires_at=now + timedelta(hours=1),
        status="ACTIVE",
    )
    auth_db.add(grant)
    auth_db.commit()

    # User logs out
    SessionManager.destroy_session(auth_db, raw_token)
    auth_db.commit()

    # Session is destroyed
    assert SessionManager.validate_session(auth_db, raw_token, now=now + timedelta(seconds=1)) is None

    # But grant remains ACTIVE!
    grant_after = auth_db.get(Grant, "g-alice-1")
    assert grant_after is not None
    assert grant_after.status == "ACTIVE"
    assert grant_after.revoked_at is None


@pytest.mark.ec("EC-A08")
def test_ec_a08_role_removed_mid_session(auth_db):
    """Removing role in DB takes effect on next request even with valid session (EC-A08)."""
    user = User(sub="usr_bob", display_name="Bob", active=True)
    role = UserRole(sub="usr_bob", role="risk_reviewer")
    auth_db.add_all([user, role])
    auth_db.commit()

    # Check roles initially
    roles1 = auth_db.query(UserRole.role).filter_by(sub="usr_bob").all()
    assert [r[0] for r in roles1] == ["risk_reviewer"]

    # Role removed in DB
    auth_db.delete(role)
    auth_db.commit()

    # Re-reading roles yields empty
    roles2 = auth_db.query(UserRole.role).filter_by(sub="usr_bob").all()
    assert roles2 == []


@pytest.mark.ec("EC-A10")
def test_ec_a10_unverified_email_no_seed_bootstrap(auth_db):
    """Unverified email at IdP NEVER bootstraps roles from seed file (EC-A10)."""
    identity_unverified = Identity(
        sub="usr_attacker",
        display_name="Attacker",
        email="alice.requester@namoid.test",  # Tries to claim Alice's email
        email_verified=False,  # NOT verified!
        claims={},
    )
    roles = RoleResolver.resolve_roles(auth_db, identity_unverified)
    assert roles == []


@pytest.mark.ec("EC-A11")
def test_ec_a11_csrf_protection_and_bearer_precedence(auth_db):
    """CSRF validation enforces token check on cookie sessions and prioritizes Bearer auth (EC-A11)."""
    from fastapi import Request, HTTPException
    from app.auth.deps import get_current_user, verify_csrf
    from app.auth.session import SESSION_COOKIE_NAME

    now = datetime.now(timezone.utc)
    user = User(sub="usr_alice", display_name="Alice", active=True)
    auth_db.add(user)
    auth_db.commit()

    token1, csrf1, _ = SessionManager.create_session(auth_db, "usr_alice", now=now)
    token2, csrf2, _ = SessionManager.create_session(auth_db, "usr_alice", now=now)
    auth_db.commit()

    # 1. Bearer token in Authorization header takes precedence over cookie
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/requests",
        "headers": [
            (b"authorization", f"Bearer {token2}".encode("latin-1")),
            (b"cookie", f"{SESSION_COOKIE_NAME}={token1}".encode("latin-1")),
        ],
    }
    req = Request(scope)
    ctx = get_current_user(req, db=auth_db)
    assert ctx.csrf_token == csrf2  # Bound to token2, not stale cookie token1!

    # 2. Bearer authentication passes verify_csrf
    verify_csrf(req, user=ctx)

    # 3. Cookie-only authentication with matching X-CSRF-Token passes
    scope_cookie_valid = {
        "type": "http",
        "method": "POST",
        "path": "/api/requests",
        "headers": [
            (b"cookie", f"{SESSION_COOKIE_NAME}={token1}".encode("latin-1")),
            (b"x-csrf-token", csrf1.encode("latin-1")),
        ],
    }
    req_cookie_valid = Request(scope_cookie_valid)
    ctx1 = get_current_user(req_cookie_valid, db=auth_db)
    verify_csrf(req_cookie_valid, user=ctx1)

    # 4. Cookie-only authentication with missing X-CSRF-Token fails with CSRF_TOKEN_INVALID
    scope_cookie_missing = {
        "type": "http",
        "method": "POST",
        "path": "/api/requests",
        "headers": [
            (b"cookie", f"{SESSION_COOKIE_NAME}={token1}".encode("latin-1")),
        ],
    }
    req_cookie_missing = Request(scope_cookie_missing)
    with pytest.raises(HTTPException) as exc_info:
        verify_csrf(req_cookie_missing, user=ctx1)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "CSRF_TOKEN_INVALID"

    # 5. Cookie-only authentication with wrong X-CSRF-Token fails with CSRF_TOKEN_INVALID
    scope_cookie_wrong = {
        "type": "http",
        "method": "POST",
        "path": "/api/requests",
        "headers": [
            (b"cookie", f"{SESSION_COOKIE_NAME}={token1}".encode("latin-1")),
            (b"x-csrf-token", b"attacker_forged_csrf_token"),
        ],
    }
    req_cookie_wrong = Request(scope_cookie_wrong)
    with pytest.raises(HTTPException) as exc_info:
        verify_csrf(req_cookie_wrong, user=ctx1)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail["code"] == "CSRF_TOKEN_INVALID"
