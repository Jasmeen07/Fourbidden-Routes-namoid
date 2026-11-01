"""Grants management, revocation, extension, and immutability endpoints (BLUEPRINT §8, §13)."""
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Request, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from app.db.engine import get_db
from app.db.models import Grant, AccessRequest, Resource, AuditEvent
from app.auth.deps import get_current_user, verify_csrf, UserContext
from app.services.grants import GrantsService
from app.services.audit import AuditService
from app.domain.effective import compute_effective_status

router = APIRouter(prefix="/api/grants", tags=["grants"])


class RevokePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason_code: str
    emergency: bool = False
    note: str | None = Field(None, max_length=1000)


@router.get("")
def list_grants(
    request: Request,
    status: Literal["active", "all"] = "active",
    scope: Literal["mine", "visible"] = "mine",
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    is_privileged = any(r.lower() in ("admin", "executive", "compliance", "security_admin", "data_governance", "risk_reviewer", "manager", "resource_owner") for r in user.roles)
    stmt = select(Grant).order_by(Grant.activated_at.desc())
    if scope == "mine":
        stmt = stmt.where(Grant.requester_sub == user.sub)
    elif scope in ("visible", "all"):
        if not is_privileged:
            stmt = stmt.outerjoin(Resource, Grant.resource_id == Resource.id).where(
                or_(
                    Grant.requester_sub == user.sub,
                    Resource.owner_sub == user.sub,
                )
            )

    all_grants = db.execute(stmt).scalars().all()
    results = []
    for g in all_grants:
        info = GrantsService.get_grant_with_effective_status(g, now)
        if status == "active" and info["status"] != "ACTIVE":
            continue
        res = db.get(Resource, g.resource_id)
        info["resource_name"] = res.name if res else g.resource_id
        results.append(info)

    return results


@router.get("/{grant_id}")
def get_grant_detail(
    grant_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    grant = db.get(Grant, grant_id)
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    resource = db.get(Resource, grant.resource_id)
    is_requester = grant.requester_sub == user.sub
    is_owner = resource and resource.owner_sub == user.sub
    is_reviewer = any(r in user.roles for r in ["manager", "risk_reviewer", "resource_owner"])

    if not (is_requester or is_owner or is_reviewer):
        raise HTTPException(status_code=404, detail="Grant not found")

    info = GrantsService.get_grant_with_effective_status(grant, now)
    info["resource_name"] = resource.name if resource else grant.resource_id

    # Lineage from associated request slots
    req = grant.request
    lineage = []
    if req:
        for s in req.slots:
            lineage.append({
                "slot_role": s.slot_role,
                "decided_by_sub": s.decided_by_sub,
                "decision": s.decision,
                "approved_limits": s.approved_limits,
                "rationale": s.rationale,
                "decided_at": s.decided_at.isoformat() if s.decided_at else None,
            })

    info["lineage"] = lineage
    info["server_now"] = now.isoformat()
    return info


@router.post("/{grant_id}/revoke", dependencies=[Depends(verify_csrf)])
def revoke_grant(
    grant_id: str,
    payload: RevokePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    policy = request.app.state.policy

    grant = GrantsService.revoke_grant(
        db=db,
        policy=policy,
        grant_id=grant_id,
        revoker_sub=user.sub,
        reason_code=payload.reason_code,
        emergency=payload.emergency,
        note=payload.note,
        now=now,
    )
    db.commit()

    return {
        "id": grant.id,
        "status": "REVOKED",
        "revoked_at": grant.revoked_at.isoformat(),
        "revoked_by_sub": grant.revoked_by_sub,
        "revoke_emergency": grant.revoke_emergency,
    }


@router.post("/{grant_id}/release-early", dependencies=[Depends(verify_csrf)])
def release_grant_early(
    grant_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Innovation 5: Smart Access Utilization - Requester releases active grant early."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    policy = request.app.state.policy

    grant = GrantsService.revoke_grant(
        db=db,
        policy=policy,
        grant_id=grant_id,
        revoker_sub=user.sub,
        reason_code="PURPOSE_COMPLETE",
        emergency=False,
        note="Released early by requester upon task completion (Innovation 5).",
        now=now,
    )
    db.commit()

    return {
        "id": grant.id,
        "status": "REVOKED",
        "released_early": True,
        "revoked_at": grant.revoked_at.isoformat(),
        "revoked_by_sub": grant.revoked_by_sub,
    }


# EC-G03: Explicit 405 on mutating grants directly (tamper attempt)
@router.api_route("/{grant_id}", methods=["PUT", "PATCH", "DELETE"])
def block_grant_tampering(
    grant_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Direct modification of grant scope or status via HTTP is strictly forbidden and audited (EC-G03)."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    AuditService.append_event(
        session=db,
        event_type="SECURITY_TAMPER_ATTEMPT",
        subject_type="grant",
        subject_id=grant_id,
        payload={
            "attempt": f"direct_http_{request.method}",
            "error": "METHOD_NOT_ALLOWED_GRANT_IMMUTABLE",
        },
        actor_sub=user.sub,
        now=now,
    )
    db.commit()

    raise HTTPException(
        status_code=405,
        detail={
            "code": "METHOD_NOT_ALLOWED_GRANT_IMMUTABLE",
            "message": "Grants are strictly immutable. Scope columns cannot be edited via HTTP.",
        },
    )
