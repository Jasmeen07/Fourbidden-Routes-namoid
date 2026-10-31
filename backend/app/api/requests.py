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


def compute_request_priority(req: AccessRequest, resource_tier: str | None, now: datetime) -> dict:
    """Innovation 2: Urgency-based Priority Scoring & SLA calculations."""
    created = req.created_at if req.created_at.tzinfo else req.created_at.replace(tzinfo=timezone.utc)
    current = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    waiting_hours = max(0.1, round((current - created).total_seconds() / 3600.0, 1))

    score = 15
    reasons = []

    tier = resource_tier or "INTERNAL_SYNTHETIC"
    if tier == "RESTRICTED_SYNTHETIC":
        score += 30
        reasons.append("Restricted sensitivity resource (+30)")
    elif tier == "INTERNAL_SYNTHETIC":
        score += 15
        reasons.append("Internal tier resource (+15)")
    else:
        reasons.append("Public tier resource (+5)")

    if req.duration_minutes <= 60:
        score += 20
        reasons.append("Short turnaround deadline (+20)")
    elif req.duration_minutes <= 1440:
        score += 10
        reasons.append("Standard business day window (+10)")

    wait_pts = min(35, int(waiting_hours * 2.5))
    if wait_pts > 0:
        score += wait_pts
        reasons.append(f"In review queue for {waiting_hours}h (+{wait_pts})")

    score = min(100, score)
    if score >= 70:
        band = "CRITICAL"
    elif score >= 45:
        band = "HIGH"
    elif score >= 25:
        band = "MEDIUM"
    else:
        band = "LOW"

    sla_hours = 24.0
    sla_remaining = max(0.0, round(sla_hours - waiting_hours, 1))
    is_overdue = waiting_hours > sla_hours

    return {
        "priority_score": score,
        "priority_band": band,
        "waiting_hours": waiting_hours,
        "sla_hours_remaining": sla_remaining,
        "is_overdue": is_overdue,
        "priority_reasons": reasons,
    }


@router.get("/analytics/bottlenecks")
def get_approval_bottlenecks(
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Innovation 2: Approval Bottleneck Detection across review stages."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    # Analyze all open pending slots
    pending_slots = db.execute(
        select(ReviewSlot).join(AccessRequest).where(
            and_(
                ReviewSlot.status == "PENDING",
                AccessRequest.status == "IN_REVIEW",
            )
        )
    ).scalars().all()

    stage_stats = {
        "manager": {"pending_count": 0, "total_wait_hours": 0.0, "overdue_count": 0},
        "risk_reviewer": {"pending_count": 0, "total_wait_hours": 0.0, "overdue_count": 0},
        "resource_owner": {"pending_count": 0, "total_wait_hours": 0.0, "overdue_count": 0},
    }

    current = now if now.tzinfo else now.replace(tzinfo=timezone.utc)

    for slot in pending_slots:
        req = slot.request
        created = req.created_at if req.created_at.tzinfo else req.created_at.replace(tzinfo=timezone.utc)
        wait_hours = max(0.1, (current - created).total_seconds() / 3600.0)
        role = slot.slot_role
        if role in stage_stats:
            stage_stats[role]["pending_count"] += 1
            stage_stats[role]["total_wait_hours"] += wait_hours
            if wait_hours > 24.0:
                stage_stats[role]["overdue_count"] += 1

    bottlenecks = []
    for role, stats in stage_stats.items():
        count = stats["pending_count"]
        avg_wait = round(stats["total_wait_hours"] / count, 1) if count > 0 else 0.0
        is_bottleneck = count >= 2 or avg_wait > 12.0
        rec = None
        if is_bottleneck:
            rec = f"{role.replace('_', ' ').title()} stage has {count} pending requests averaging {avg_wait}h wait time."

        bottlenecks.append({
            "stage": role,
            "stage_label": role.replace("_", " ").title(),
            "pending_count": count,
            "avg_wait_hours": avg_wait,
            "overdue_count": stats["overdue_count"],
            "is_bottleneck": is_bottleneck,
            "recommendation": rec,
        })

    has_active_bottleneck = any(b["is_bottleneck"] for b in bottlenecks)
    return {
        "has_bottleneck": has_active_bottleneck,
        "stages": bottlenecks,
        "evaluated_at": current.isoformat(),
    }


@router.get("")
def list_requests(
    request: Request,
    view: Literal["mine", "assigned", "visible"] = "mine",
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

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
        stmt = stmt.outerjoin(ReviewSlot).outerjoin(Resource, AccessRequest.resource_id == Resource.id).where(
            or_(
                AccessRequest.requester_sub == user.sub,
                ReviewSlot.assigned_sub == user.sub,
                Resource.owner_sub == user.sub,
            )
        ).distinct()

    requests = db.execute(stmt).scalars().all()
    results = []
    for r in requests:
        res = db.get(Resource, r.resource_id)
        tier = res.tier if res else None
        p_info = compute_request_priority(r, tier, now)
        results.append({
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
            "priority": p_info,
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


@router.get("/{request_id}/assistance")
def get_approval_assistance(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Innovation 3: Intelligent Approval Assistance for Manager, Risk Reviewer, and Resource Owner."""
    req = db.get(AccessRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    resource = db.get(Resource, req.resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    priority_info = compute_request_priority(req, resource.tier, now)

    action_weights = {a["name"]: a.get("risk_weight", 2) for a in resource.allowed_actions}
    finding = compute_risk_lens_finding(
        tier=resource.tier,
        action_weights=action_weights,
        requested_actions=req.actions,
        duration_minutes=req.duration_minutes,
        risk_controls=req.risk_controls,
    )

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
            "title": "Manager Review Guidance: Business Need & Project Alignment",
            "focus_areas": [
                f"Verify need for purpose '{req.purpose_code}' aligns with current deliverables.",
                f"Assess whether requested duration ({req.duration_minutes}m) is proportional to business scope.",
                "Confirm requester is authorized for this project workstream.",
            ],
            "key_questions": [
                "Does the stated work align with project milestones?",
                "Can this deliverable be completed in a shorter evaluation window?",
            ],
        },
        "risk_reviewer": {
            "title": "Risk Reviewer Guidance: Security Posture, Controls & Sensitivity",
            "focus_areas": [
                f"Evaluate sensitivity tier ({resource.tier}) and risk score ({finding.score}/100 - {finding.band.upper()}).",
                f"Check declared controls: {', '.join(req.risk_controls)}.",
                f"Audit action privileges: {', '.join(req.actions)}.",
            ],
            "key_questions": [
                "Are synthetic-data and output-filtering controls actively enforced?",
                "Should high-privilege actions like export or batch query be narrowed?",
            ],
        },
        "resource_owner": {
            "title": "Resource Owner Guidance: Dataset/Model Suitability & Blast Radius",
            "focus_areas": [
                f"Verify that model/dataset '{resource.name}' ({resource.kind}) is the correct target.",
                f"Ensure permitted operations ({', '.join(req.actions)}) do not exceed operational boundaries.",
                "Review any prior narrowings applied by Manager or Risk Reviewer.",
            ],
            "key_questions": [
                "Is access to the full dataset needed, or would sample reads suffice?",
                "Does this request introduce concurrent contention or quota impact?",
            ],
        },
    }

    return {
        "request_id": req.id,
        "resource_name": resource.name,
        "resource_tier": resource.tier,
        "risk_score": finding.score,
        "risk_band": finding.band,
        "priority": priority_info,
        "guidance": guidance,
        "lineage": lineage,
        "suggestions": [s.model_dump() for s in finding.suggestions],
    }
