"""Policy discovery and FORGE hierarchy assurance endpoints (FORGE §7, §8)."""
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import Resource, User
from app.auth.deps import get_current_user, UserContext
from app.domain.policy import lint_policy
from app.domain.hierarchy import (
    Employee,
    Agent,
    determine_required_approval_steps,
    is_crucial_resource,
)

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
    """Assurance Engineering: Policy-as-Code consistency linter."""
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
    """FORGE Hierarchy Approval Routing Simulation (§7, §8)."""
    resource = db.get(Resource, payload.resource_id)
    requester = db.get(User, payload.requester_sub)

    if not resource or not requester:
        return {"error": "Resource or requester not found"}

    all_users = db.execute(select(User)).scalars().all()
    employees: dict[str, Employee] = {}
    agents: dict[str, Agent] = {}

    for u in all_users:
        if u.is_agent:
            agents[u.sub] = Agent(
                id=u.sub,
                name=u.display_name,
                owner_id=u.owner_sub or "",
                department=u.department or "General",
                delegated_permissions=tuple(u.delegated_permissions or []),
            )
        else:
            employees[u.sub] = Employee(
                id=u.sub,
                name=u.display_name,
                role=u.roles[0].role if u.roles else "employee",
                department=u.department or "General",
                manager_id=u.manager_sub,
                email=u.email,
            )

    tier = resource.tier
    sens = getattr(resource, "sensitivity", "INTERNAL")
    crucial = bool(getattr(resource, "is_crucial", False)) or is_crucial_resource(
        payload.resource_id, tier=tier, sensitivity=sens
    )
    res_dept = getattr(resource, "department", "General")

    steps = determine_required_approval_steps(
        requester_id=payload.requester_sub,
        resource_id=payload.resource_id,
        resource_dept=res_dept,
        resource_owner_id=resource.owner_sub,
        is_crucial=crucial,
        employees=employees,
        agents=agents,
        security_officer_id="R001",
    )

    routing_preview = []
    for step in steps:
        routing_preview.append({
            "slot_role": step.slot_role,
            "assigned_sub": step.assigned_sub,
            "level": step.level,
            "title": step.title,
            "is_crucial_escalation": step.is_crucial_escalation,
            "is_self_conflict": step.assigned_sub == payload.requester_sub,
        })

    return {
        "resource_id": payload.resource_id,
        "resource_name": resource.name,
        "requester_sub": payload.requester_sub,
        "is_crucial": crucial,
        "is_cross_dept": (requester.department or "").lower() != res_dept.lower(),
        "tier": tier,
        "routing": routing_preview,
        "routing_mode": "MULTI_TIER_CRUCIAL_ESCALATION" if crucial or (requester.department or "").lower() != res_dept.lower() else "STANDARD_IMMEDIATE_SUPERIOR",
        "datalog_rule": "Crucial/Cross-dept requires multi-level escalation to Executive (CTO/CFO), Resource Owner, and Security Officer (R001)" if (crucial or (requester.department or "").lower() != res_dept.lower()) else "Standard same-dept requests require only Immediate Superior approval",
    }
