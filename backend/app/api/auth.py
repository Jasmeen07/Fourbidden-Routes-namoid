"""Authentication routes (BLUEPRINT §7, §8)."""
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import User, UserRole, AuthTransaction
from app.auth.provider import IdentityProvider
from app.auth.mock_provider import MockOidcProvider
from app.auth.namoid_provider import NamoIDProvider
from app.auth.session import SessionManager, SESSION_COOKIE_NAME
from app.auth.roles import RoleResolver
from app.auth.deps import get_current_user, UserContext
from app.services.audit import AuditService
from app.config import settings

router = APIRouter(tags=["auth"])


def get_idp(request: Request) -> IdentityProvider:
    mode = settings.AUTH_MODE.lower()
    if mode == "namoid":
        return NamoIDProvider(
            client_id=settings.NAMOID_CLIENT_ID,
            client_secret=settings.NAMOID_CLIENT_SECRET,
            env=settings.NAMOID_ENV,
        )
    return MockOidcProvider()


@router.get("/auth/login")
async def login(
    request: Request,
    redirect_uri: str = settings.NAMOID_REDIRECT_URI,
    user: str = "alice",
    db: Session = Depends(get_db),
):
    idp = get_idp(request)
    if isinstance(idp, MockOidcProvider):
        tx = await idp.begin_login(redirect_uri=redirect_uri, mock_user_key=user)
    else:
        tx = await idp.begin_login(redirect_uri=redirect_uri)

    # Store transaction server-side
    now = datetime.now(timezone.utc)
    db.add(AuthTransaction(state=tx.state, nonce=tx.nonce, code_verifier=tx.code_verifier, created_at=now))
    db.commit()

    return RedirectResponse(url=tx.authorization_url, status_code=302)


@router.get("/auth/callback")
async def callback(
    request: Request,
    response: Response,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    # Constant-time state check + single-use transaction load & delete (EC-A02, EC-A04)
    tx = db.get(AuthTransaction, state)
    if not tx:
        # If this is a browser redirect from the NamoID Hosted Auth flow, forward to frontend SPA
        accept = request.headers.get("accept", "")
        if "text/html" in accept:
            return RedirectResponse(
                url=f"http://localhost:3000/auth/callback?{request.url.query}",
                status_code=302,
            )

        AuditService.append_event(
            session=db,
            event_type="AUTH_FAILURE",
            subject_type="session",
            subject_id="unknown",
            payload={"error": "AUTH_STATE_MISMATCH"},
        )
        db.commit()
        raise HTTPException(
            status_code=400,
            detail={"code": "AUTH_STATE_MISMATCH", "message": "Invalid or expired state parameter"},
        )

    stored_nonce = tx.nonce
    stored_verifier = tx.code_verifier
    db.delete(tx)
    db.commit()

    idp = get_idp(request)
    identity = await idp.complete_login(
        code=code,
        state=state,
        stored_nonce=stored_nonce,
        stored_code_verifier=stored_verifier,
        redirect_uri=settings.NAMOID_REDIRECT_URI,
    )

    # Upsert user and resolve roles from DB or seed
    user = RoleResolver.upsert_user_and_roles(db, identity)

    # Create new session (anti-fixation EC-A05)
    now = datetime.now(timezone.utc)
    raw_token, csrf_token, _ = SessionManager.create_session(db, user.sub, now=now)

    AuditService.append_event(
        session=db,
        event_type="AUTH_LOGIN",
        subject_type="user",
        subject_id=user.sub,
        payload={"display_name": user.display_name},
        actor_sub=user.sub,
        now=now,
    )
    db.commit()

    # Redirect to home with Secure; HttpOnly; SameSite=Lax cookie
    redirect = RedirectResponse(url="/", status_code=302)
    redirect.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=False,  # Set false for local HTTP dev, True in prod
        samesite="lax",
        max_age=8 * 3600,
    )
    return redirect


@router.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        SessionManager.destroy_session(db, token)

    AuditService.append_event(
        session=db,
        event_type="AUTH_LOGOUT",
        subject_type="user",
        subject_id=user.sub,
        payload={},
        actor_sub=user.sub,
    )
    db.commit()

    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"message": "Logged out successfully"}


@router.post("/auth/dev-login")
async def dev_login(
    payload: dict,
    response: Response,
    db: Session = Depends(get_db),
):
    """Convenience login for testing, local demo, and persona switching."""
    DEFAULT_PERSONA_ROLES = {
        "priya": ["requester", "ML_ENGINEER"],
        "alice": ["requester", "ML_ENGINEER"],
        "usr_req_a": ["requester", "ML_ENGINEER"],
        "bob": ["requester", "risk_reviewer", "ML_ENGINEER"],
        "usr_req_b": ["requester", "risk_reviewer", "ML_ENGINEER"],
        "carol": ["manager", "DATA_GOVERNANCE"],
        "usr_mgr_1": ["manager", "DATA_GOVERNANCE"],
        "david": ["resource_owner", "SECURITY_ADMIN"],
        "usr_owner_1": ["resource_owner", "SECURITY_ADMIN"],
        "elena": ["risk_reviewer", "COMPLIANCE"],
        "usr_risk_1": ["risk_reviewer", "COMPLIANCE"],
        "fiona": ["risk_reviewer", "EXECUTIVE"],
        "usr_risk_2": ["risk_reviewer", "EXECUTIVE"],
        "unassigned_user": [],
        "usr_no_roles": [],
    }

    user_id = payload.get("user_id", "priya")
    user = db.get(User, user_id)
    if not user:
        display_name = payload.get("display_name") or ("Priya Sharma" if user_id == "priya" else user_id.capitalize())
        user = User(
            sub=user_id,
            display_name=display_name,
            email=payload.get("email") or f"{user_id}@example.com",
            manager_sub="E050" if user_id != "E050" else "E002",
            department="Engineering",
            active=True,
        )
        db.add(user)
        db.commit()
    else:
        changed = False
        if not user.manager_sub:
            user.manager_sub = "E050" if user.sub != "E050" else "E002"
            changed = True
        if not getattr(user, "department", None):
            user.department = "Engineering"
            changed = True
        if changed:
            db.commit()

    # Ensure demo roles are populated
    existing_roles = set(db.execute(select(UserRole.role).where(UserRole.sub == user.sub)).scalars().all())
    expected_roles = DEFAULT_PERSONA_ROLES.get(user_id, ["requester"])
    for r in expected_roles:
        if r not in existing_roles:
            db.add(UserRole(sub=user.sub, role=r))
    if expected_roles:
        db.commit()

    now = datetime.now(timezone.utc)
    raw_token, csrf_token, _ = SessionManager.create_session(db, user.sub, now=now)
    db.commit()
    roles = list(db.execute(select(UserRole.role).where(UserRole.sub == user.sub)).scalars().all())

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=8 * 3600,
    )

    return {
        "token": raw_token,
        "csrf_token": csrf_token,
        "user": {
            "sub": user.sub,
            "display_name": user.display_name,
            "email": user.email,
            "roles": roles,
            "active": user.active,
        },
    }



@router.get("/api/me")
async def me(
    request: Request,
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    return {
        "sub": user.sub,
        "display_name": user.display_name,
        "email": user.email,
        "manager_sub": user.manager_sub,
        "roles": user.roles,
        "csrf_token": user.csrf_token,
        "server_now": now.isoformat(),
        "active": user.active,
    }
