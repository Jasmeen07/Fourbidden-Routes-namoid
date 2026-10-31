"""Access Request and Decision API routes (BLUEPRINT §8, §13)."""
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Request, Depends, HTTPException, Query, Header
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from app.db.engine import get_db
from app.db.models import AccessRequest, ReviewSlot, Resource, AuditEvent
from app.auth.deps import get_current_user, verify_csrf, UserContext
from app.services.requests import RequestsService
from app.services.reviews import ReviewsService
from app.ai.risk_lens import compute_risk_lens_finding
from app.ai.narrator import TemplateNarrator

router = APIRouter(prefix="/api/requests", tags=["requests"])


class CreateRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resource_id: str
    purpose_code: str
    purpose_text: str = Field(..., max_length=1000)
    actions: list[str]
    duration_minutes: int
    risk_controls: list[str]
    extends_grant_id: str | None = None


class DecisionPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slot_id: str
    decision: Literal["approve", "narrow", "reject"]
    approved_limits: dict | None = None
    rationale: str | None = Field(None, max_length=1000)
    expected_request_hash: str | None = None


@router.post("", dependencies=[Depends(verify_csrf)])
def create_request(
    payload: CreateRequestPayload,
    request: Request,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    policy = request.app.state.policy

    req = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub=user.sub,
        resource_id=payload.resource_id,
        purpose_code=payload.purpose_code,
        purpose_text=payload.purpose_text,
        actions=payload.actions,
        duration_minutes=payload.duration_minutes,
        risk_controls=payload.risk_controls,
        extends_grant_id=payload.extends_grant_id,
        now=now,
    )
    db.commit()

    return {
        "id": req.id,
        "status": req.status,
        "resource_id": req.resource_id,
        "purpose_code": req.purpose_code,
        "actions": req.actions,
        "duration_minutes": req.duration_minutes,
        "created_at": req.created_at.isoformat(),
        "content_hash": req.content_hash,
    }


@router.get("")
def list_requests(
    view: Literal["mine", "assigned", "visible"] = "mine",
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    stmt = select(AccessRequest).order_by(AccessRequest.created_at.desc())
    if view == "mine":
        stmt = stmt.where(AccessRequest.requester_sub == user.sub)
    elif view == "assigned":
        stmt = stmt.join(ReviewSlot).where(
            and_(
                ReviewSlot.assigned_sub == user.sub,
                ReviewSlot.status == "PENDING",
            )
        )
    elif view == "visible":
        # Requester or assigned slot or resource owner
        stmt = stmt.outerjoin(ReviewSlot).outerjoin(Resource, AccessRequest.resource_id == Resource.id).where(
            or_(
                AccessRequest.requester_sub == user.sub,
                ReviewSlot.assigned_sub == user.sub,
                Resource.owner_sub == user.sub,
            )
        ).distinct()

    requests = db.execute(stmt).scalars().all()
    return [
        {
            "id": r.id,
            "requester_sub": r.requester_sub,
            "resource_id": r.resource_id,
            "purpose_code": r.purpose_code,
            "status": r.status,
            "actions": r.actions,
            "duration_minutes": r.duration_minutes,
            "created_at": r.created_at.isoformat(),
            "slots_count": len(r.slots),
            "pending_slots": [s.slot_role for s in r.slots if s.status == "PENDING"],
        }
        for r in requests
    ]


@router.get("/{request_id}")
def get_request_detail(
    request_id: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Visibility rule (§13): requester, assigned reviewers, resource owner
    resource = db.get(Resource, req.resource_id)
    is_requester = req.requester_sub == user.sub
    is_assigned = any(s.assigned_sub == user.sub for s in req.slots)
    is_owner = resource and resource.owner_sub == user.sub

    if not (is_requester or is_assigned or is_owner):
        raise HTTPException(status_code=404, detail="Request not found")

    return {
        "id": req.id,
        "requester_sub": req.requester_sub,
        "resource_id": req.resource_id,
        "purpose_code": req.purpose_code,
        "purpose_text": req.purpose_text,
        "actions": req.actions,
        "duration_minutes": req.duration_minutes,
        "risk_controls": req.risk_controls,
        "status": req.status,
        "policy_version": req.policy_version,
        "content_hash": req.content_hash,
        "extends_grant_id": req.extends_grant_id,
        "created_at": req.created_at.isoformat(),
        "grant_id": req.grant.id if req.grant else None,
        "slots": [
            {
                "id": s.id,
                "slot_role": s.slot_role,
                "assigned_sub": s.assigned_sub,
                "status": s.status,
                "decision": s.decision,
                "approved_limits": s.approved_limits,
                "rationale": s.rationale,
                "decided_by_sub": s.decided_by_sub,
                "decided_at": s.decided_at.isoformat() if s.decided_at else None,
            }
            for s in req.slots
        ],
    }


@router.post("/{request_id}/withdraw", dependencies=[Depends(verify_csrf)])
def withdraw_request(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    req = RequestsService.withdraw_request(db, request_id, user.sub, now=now)
    db.commit()
    return {"id": req.id, "status": req.status}


@router.post("/{request_id}/decisions", dependencies=[Depends(verify_csrf)])
def record_decision(
    request_id: str,
    payload: DecisionPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    req, slot, grant = ReviewsService.record_decision(
        db=db,
        request_id=request_id,
        slot_id=payload.slot_id,
        decision=payload.decision,
        reviewer_sub=user.sub,
        approved_limits=payload.approved_limits,
        rationale=payload.rationale,
        expected_request_hash=payload.expected_request_hash,
        now=now,
    )
    db.commit()

    return {
        "request_id": req.id,
        "request_status": req.status,
        "slot_id": slot.id,
        "slot_status": slot.status,
        "grant_id": grant.id if grant else None,
    }


@router.get("/{request_id}/risk")
async def get_request_risk(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Innovation Module 1: Risk Lens - Explainable Risk Scoring and Counterfactuals."""
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    resource = db.get(Resource, req.resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    action_weights = {a["name"]: a.get("risk_weight", 2) for a in resource.allowed_actions}

    finding = compute_risk_lens_finding(
        tier=resource.tier,
        action_weights=action_weights,
        requested_actions=req.actions,
        duration_minutes=req.duration_minutes,
        risk_controls=req.risk_controls,
    )

    narrator = TemplateNarrator()
    summary = await narrator.narrate_finding(finding, req.purpose_text)
    finding.summary_text = summary

    return finding.model_dump()
