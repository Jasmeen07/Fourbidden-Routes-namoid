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
from app.db.models import User
from app.domain.hierarchy import is_crucial_resource

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
    request: Request,
    view: Literal["mine", "assigned", "visible", "all"] = "mine",
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    stmt = select(AccessRequest).order_by(AccessRequest.created_at.desc())
    is_admin = "admin" in user.roles or "executive" in user.roles
    if view == "all" and is_admin:
        pass
    elif view == "mine":
        stmt = stmt.where(AccessRequest.requester_sub == user.sub)
    elif view == "assigned":
        stmt = stmt.join(ReviewSlot).where(
            and_(
                ReviewSlot.status == "PENDING",
                or_(
                    ReviewSlot.assigned_sub == user.sub,
                    ReviewSlot.slot_role.in_(user.roles),
                ),
                AccessRequest.requester_sub != user.sub,
            )
        ).distinct()
    elif view == "visible":
        if is_admin:
            pass  # Admins have full operational visibility
        else:
            stmt = stmt.outerjoin(ReviewSlot).outerjoin(Resource, AccessRequest.resource_id == Resource.id).where(
                or_(
                    AccessRequest.requester_sub == user.sub,
                    ReviewSlot.assigned_sub == user.sub,
                    ReviewSlot.slot_role.in_(user.roles),
                    Resource.owner_sub == user.sub,
                )
            ).distinct()

    requests = db.execute(stmt).scalars().all()
    results = []
    for r in requests:
        res = db.get(Resource, r.resource_id)
        req_user = db.get(User, r.requester_sub)
        results.append({
            "id": r.id,
            "requester_sub": r.requester_sub,
            "requester_name": req_user.display_name if req_user else r.requester_sub,
            "requester_dept": req_user.department if req_user else "Engineering",
            "resource_id": r.resource_id,
            "resource_name": res.name if res else r.resource_id,
            "resource_tier": res.tier if res else "INTERNAL_SYNTHETIC",
            "resource_kind": res.kind if res else "dataset",
            "purpose_code": r.purpose_code,
            "purpose_text": r.purpose_text,
            "status": r.status,
            "actions": r.actions,
            "duration_minutes": r.duration_minutes,
            "risk_controls": r.risk_controls,
            "created_at": r.created_at.isoformat(),
            "slots_count": len(r.slots),
            "pending_slots": [s.slot_role for s in r.slots if s.status == "PENDING"],
            "slots": [
                {
                    "id": s.id,
                    "slot_role": s.slot_role,
                    "assigned_sub": s.assigned_sub,
                    "status": s.status,
                    "decision": s.decision,
                    "rationale": s.rationale,
                    "approved_limits": s.approved_limits,
                    "decided_by_sub": s.decided_by_sub,
                    "decided_at": s.decided_at.isoformat() if s.decided_at else None,
                }
                for s in r.slots
            ],
            "is_crucial": bool(getattr(res, "is_crucial", False)) if res else False,
        })
    return results


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


@router.get("/{request_id}/assistance")
def get_approval_assistance(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """FORGE Hierarchy Approval Guidance for Reviewers."""
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    resource = db.get(Resource, req.resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    requester = db.get(User, req.requester_sub)
    is_agent = requester.is_agent if requester else False
    owner_sub = requester.owner_sub if requester else None
    requester_dept = requester.department if requester else "General"
    resource_dept = getattr(resource, "department", "General")
    resource_sens = getattr(resource, "sensitivity", "INTERNAL")
    crucial = bool(getattr(resource, "is_crucial", False)) or is_crucial_resource(
        req.resource_id, tier=resource.tier, sensitivity=resource_sens
    )
    is_cross_dept = requester_dept.lower() != resource_dept.lower()

    lineage = []
    for s in req.slots:
        if s.status in ["APPROVED", "NARROWED", "REJECTED"]:
            lineage.append({
                "slot_role": s.slot_role,
                "decided_by_sub": s.decided_by_sub,
                "status": s.status,
                "decision": s.decision,
                "approved_limits": s.approved_limits,
                "rationale": s.rationale,
                "decided_at": s.decided_at.isoformat() if s.decided_at else None,
            })

    guidance = {
        "manager": {
            "title": "Immediate Superior Review: Justification & Agent Responsibility",
            "focus_areas": [
                f"Verify need for purpose '{req.purpose_code}' matches business objectives.",
                f"Assess whether requested duration ({req.duration_minutes}m) is strictly necessary.",
                f"For AI Agent requests: Human owner '{owner_sub}' is legally accountable for actions.",
            ],
            "key_questions": [
                "Does the proposed workload align with active team tasks?",
                "Can actions be narrowed to read-only before granting write/export privileges?",
            ],
        },
        "executive": {
            "title": "Executive Review (CTO/CFO): Crucial Data & Escalation Governance",
            "focus_areas": [
                f"High-governance review for crucial dataset '{resource.name}' ({resource_sens}).",
                f"Confirm inter-departmental necessity: {requester_dept} requesting {resource_dept} assets.",
                "Verify blast radius and compliance impact under company governance rules.",
            ],
            "key_questions": [
                "Is access to restricted production/finance data strictly unavoidable?",
                "Are synthetic/masked alternatives adequate for this purpose?",
            ],
        },
        "resource_owner": {
            "title": "Resource Owner Review: Dataset Integrity & Scope Containment",
            "focus_areas": [
                f"Resource authorization for '{resource.name}' ({resource.kind}).",
                f"Confirm permitted operations ({', '.join(req.actions)}) do not degrade data integrity.",
                "Review any prior narrowings applied by Immediate Superior or Executive.",
            ],
            "key_questions": [
                "Is access to the full dataset needed or would partition sampling suffice?",
                "Are export or destructive actions safely constrained?",
            ],
        },
        "risk_reviewer": {
            "title": "Security Officer / Risk Reviewer: Posture & Network Guardrails",
            "focus_areas": [
                f"Evaluate sensitivity tier ({resource.tier}) and sensitivity classification ({resource_sens}).",
                f"Check declared risk controls: {', '.join(req.risk_controls)}.",
                "Audit taint propagation and ensure external exfiltration guardrails are enforced.",
            ],
            "key_questions": [
                "Are synthetic-data and output-filtering controls actively enforced?",
                "Does this principal interact with untrusted inputs that could contaminate sensitive data?",
            ],
        },
    }

    return {
        "request_id": req.id,
        "resource_name": resource.name,
        "resource_tier": resource.tier,
        "resource_sensitivity": resource_sens,
        "is_crucial": crucial,
        "is_cross_dept": is_cross_dept,
        "requester": {
            "sub": req.requester_sub,
            "department": requester_dept,
            "is_agent": is_agent,
            "owner_sub": owner_sub,
        },
        "guidance": guidance,
        "lineage": lineage,
    }
