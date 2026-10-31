"""Policy discovery and assurance engineering endpoints (BLUEPRINT §6.4, §8, §14.3 Module 4)."""
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.db.models import Resource, User, UserRole
from app.auth.deps import get_current_user, UserContext
from app.domain.policy import lint_policy

router = APIRouter(prefix="/api/policy", tags=["policy"])


class WhatIfPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requester_sub: str
    resource_id: str


@router.get("")
def get_effective_policy(request: Request):
    policy = request.app.state.policy
    return policy.model_dump()


@router.get("/lint")
def lint_policy_rules(request: Request):
    """Innovation Module 4: Policy-as-Code Linter finds deadlocks and loopholes before runtime."""
    policy = request.app.state.policy
    findings = lint_policy(policy)
    return {
        "status": "PASS" if not findings else "WARN",
        "findings_count": len(findings),
        "findings": findings,
    }


@router.post("/whatif")
def what_if_simulation(
    payload: WhatIfPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Innovation Module 4: What-If simulation for reviewer routing and deadlock prevention."""
    policy = request.app.state.policy
    resource = db.get(Resource, payload.resource_id)
    requester = db.get(User, payload.requester_sub)

    if not resource or not requester:
        return {"error": "Resource or requester not found"}

    tier = resource.tier
    required_slots = policy.approval_matrix.get(tier, [])

    routing_preview = []
    deadlock_detected = False

    for role in required_slots:
        assigned = None
        if role == "manager":
            assigned = requester.manager_sub
        elif role == "resource_owner":
            assigned = resource.owner_sub
        elif role == "risk_reviewer":
            assigned = "risk_reviewer_pool"

        is_self = assigned == payload.requester_sub
        if is_self:
            deadlock_detected = True

        routing_preview.append({
            "slot_role": role,
            "assigned_sub": assigned,
            "is_self_conflict": is_self,
        })

    return {
        "resource_id": payload.resource_id,
        "requester_sub": payload.requester_sub,
        "tier": tier,
        "routing": routing_preview,
        "deadlock": deadlock_detected,
        "note": "SoD prevents requester self-approval. Alternate reviewers required if conflict." if deadlock_detected else "Standard routing path clear."
    }
