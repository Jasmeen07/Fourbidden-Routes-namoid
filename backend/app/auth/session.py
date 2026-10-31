"""Session management, token hashing, anti-fixation, and CSRF binding (BLUEPRINT §7)."""
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import select
from app.db.models import Session as SessionModel
from app.domain.errors import DomainError

SESSION_COOKIE_NAME = "grantgate_session"
IDLE_TIMEOUT_MINUTES = 30
ABSOLUTE_TIMEOUT_HOURS = 8


def hash_session_token(token: str) -> str:
    """SHA-256 hash of opaque session token for storage at rest."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionManager:
    @staticmethod
    def create_session(
        db: DBSession,
        sub: str,
        now: datetime | None = None,
    ) -> tuple[str, str, SessionModel]:
        """
        Creates a new server-side session:
        - Rotates session ID (anti-fixation, EC-A05)
        - Generates CSRF token bound to this session
        - Sets idle and absolute expiration windows
        Returns (raw_session_token, csrf_token, session_row).
        """
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        raw_token = secrets.token_urlsafe(48)
        hashed_id = hash_session_token(raw_token)
        csrf_token = secrets.token_urlsafe(32)

        session_row = SessionModel(
            id=hashed_id,
            sub=sub,
            csrf_token=csrf_token,
            created_at=current_time,
            last_seen_at=current_time,
            absolute_expires_at=current_time + timedelta(hours=ABSOLUTE_TIMEOUT_HOURS),
        )

        db.add(session_row)
        db.flush()
        return raw_token, csrf_token, session_row

    @staticmethod
    def validate_session(
        db: DBSession,
        raw_token: str,
        now: datetime | None = None,
    ) -> SessionModel | None:
        """
        Validates a session token:
        - Verifies existence
        - Checks idle timeout (30 min)
        - Checks absolute timeout (8 hours)
        - Updates last_seen_at on success
        """
        if not raw_token:
            return None

        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        hashed_id = hash_session_token(raw_token)
        session_row = db.get(SessionModel, hashed_id)
        if not session_row:
            return None

        # Check absolute expiration
        abs_exp = session_row.absolute_expires_at
        if abs_exp.tzinfo is None:
            abs_exp = abs_exp.replace(tzinfo=timezone.utc)
        if current_time >= abs_exp:
            db.delete(session_row)
            db.flush()
            return None

        # Check idle expiration
        last_seen = session_row.last_seen_at
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        if current_time - last_seen > timedelta(minutes=IDLE_TIMEOUT_MINUTES):
            db.delete(session_row)
            db.flush()
            return None

        # Update last seen
        session_row.last_seen_at = current_time
        db.flush()
        return session_row

    @staticmethod
    def destroy_session(db: DBSession, raw_token: str) -> None:
        """Destroys a session on logout. NEVER touches active grants (CO-4, EC-A07)."""
        if not raw_token:
            return
        hashed_id = hash_session_token(raw_token)
        session_row = db.get(SessionModel, hashed_id)
        if session_row:
            db.delete(session_row)
            db.flush()
