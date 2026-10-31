"""Authentication and authorization dependencies for FastAPI (BLUEPRINT §7, §13)."""
from dataclasses import dataclass
from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import User, UserRole, Session as SessionModel
from app.auth.session import SessionManager, SESSION_COOKIE_NAME


@dataclass(frozen=True)
class UserContext:
    sub: str
    display_name: str
    email: str | None
    manager_sub: str | None
    roles: list[str]
    csrf_token: str
    active: bool


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> UserContext:
    """
    Authenticates subject and re-reads roles from DB on EVERY request (EC-A08).
    Returns 401 if unauthenticated or session expired.
    """
    # 1. Bearer Authorization header takes precedence (explicit client token)
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):].strip()

    # 2. Fall back to Session Cookie
    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME)

    if not token:
        raise HTTPException(
            status_code=401,
            detail={"code": "DENY_UNAUTHENTICATED", "message": "Authentication required"},
        )

    # Allow injected clock for testing/demo
    app = request.scope.get("app")
    clock = getattr(app.state, "clock", None) if app and hasattr(app, "state") else None
    now = clock.now() if clock else None

    session_row = SessionManager.validate_session(db, token, now=now)
    if not session_row:
        raise HTTPException(
            status_code=401,
            detail={"code": "DENY_UNAUTHENTICATED", "message": "Session expired or invalid"},
        )

    # Load user from DB
    user = db.get(User, session_row.sub)
    if not user or not user.active:
        raise HTTPException(
            status_code=403,
            detail={"code": "DENY_UNAUTHENTICATED", "message": "User inactive or not found"},
        )

    # Re-read roles dynamically from DB (EC-A08)
    roles = list(
        db.execute(select(UserRole.role).where(UserRole.sub == user.sub)).scalars().all()
    )

    return UserContext(
        sub=user.sub,
        display_name=user.display_name,
        email=user.email,
        manager_sub=user.manager_sub,
        roles=roles,
        csrf_token=session_row.csrf_token,
        active=user.active,
    )


def verify_csrf(
    request: Request,
    user: UserContext = Depends(get_current_user),
) -> None:
    """
    Enforces CSRF protection on mutating requests (POST, PUT, PATCH, DELETE)
    via X-CSRF-Token header bound to the session (BLUEPRINT §7.2).
    """
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        # Exempt auth endpoints (login callback)
        if request.url.path.startswith("/auth/"):
            return

        client_token = request.headers.get("X-CSRF-Token")
        if client_token and client_token == user.csrf_token:
            return

        # If authenticated via explicit Bearer token header,
        # ambient browser CSRF is not applicable (CORS protects custom headers).
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return

        raise HTTPException(
            status_code=403,
            detail={"code": "CSRF_TOKEN_INVALID", "message": "Missing or invalid X-CSRF-Token header"},
        )
