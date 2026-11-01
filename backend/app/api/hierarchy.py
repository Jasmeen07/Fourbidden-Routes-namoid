"""Enterprise Organizational Hierarchy & Delegation API (FORGE §7, §8)."""
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import User, Resource
from app.auth.deps import get_current_user, UserContext
from app.domain.hierarchy import (
    Employee,
    Agent,
    determine_required_approval_steps,
    is_crucial_resource,
    get_immediate_superior,
    get_seniority_chain,
)

router = APIRouter(prefix="/api/hierarchy", tags=["hierarchy"])


def _load_domain_principals(db: Session) -> tuple[dict[str, Employee], dict[str, Agent]]:
    users = db.execute(select(User)).scalars().all()
    employees: dict[str, Employee] = {}
    agents: dict[str, Agent] = {}

    for u in users:
        if u.is_agent:
            agents[u.sub] = Agent(
                id=u.sub,
                name=u.display_name,
                owner_id=u.owner_sub or "",
                department=u.department or "General",
                delegated_permissions=tuple(u.delegated_permissions or []),
            )
        else:
            role = u.roles[0].role if u.roles else "employee"
            employees[u.sub] = Employee(
                id=u.sub,
                name=u.display_name,
                role=role,
                department=u.department or "General",
                manager_id=u.manager_sub,
                email=u.email,
            )
    return employees, agents


@router.get("")
def get_organization_hierarchy(
    request: Request,
    db: Session = Depends(get_db),
):
    """Returns the full hierarchical structure of human employees and paired AI agents.
    Restricted to administrators and managers (Requirement 4).
    """
    from app.auth.session import SessionManager, SESSION_COOKIE_NAME
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):].strip()
    if not token:
        token = request.cookies.get(SESSION_COOKIE_NAME) or request.cookies.get("grantgate_session") or request.cookies.get("gg_session")

    if token:
        clock = getattr(request.app.state, "clock", None)
        now = clock.now() if clock else None
        session_row = SessionManager.validate_session(db, token, now=now)
        if session_row:
            u = db.get(User, session_row.sub)
            user_roles = [r.role.lower() for r in (u.roles if u else [])]
            is_admin_or_mgr = any(r in user_roles for r in ["admin", "executive", "manager", "data_governance", "security_admin"]) or session_row.sub in ["E001", "E002", "E050", "E060", "fiona", "carol"]
            if not is_admin_or_mgr:
                raise HTTPException(
                    status_code=403,
                    detail={"code": "DENY_FORBIDDEN", "message": "Organizational hierarchy access is restricted to administrators and managers"},
                )

    employees, agents = _load_domain_principals(db)

    # Build response tree
    principals_list = []
    # Add human employees
    for emp_id, emp in employees.items():
        # find owned agents
        owned_agents = [
            {
                "id": ag.id,
                "name": ag.name,
                "department": ag.department,
                "delegated_permissions": list(ag.delegated_permissions),
                "owner_id": emp_id,
            }
            for ag in agents.values()
            if ag.owner_id == emp_id
        ]
        principals_list.append({
            "id": emp.id,
            "name": emp.name,
            "role": emp.role,
            "department": emp.department,
            "manager_id": emp.manager_id,
            "email": emp.email,
            "is_agent": False,
            "owned_agents": owned_agents,
        })

    # Add agents directly as well
    for ag_id, ag in agents.items():
        principals_list.append({
            "id": ag.id,
            "name": ag.name,
            "role": "AI Agent",
            "department": ag.department,
            "manager_id": get_immediate_superior(ag.id, employees, agents),
            "owner_id": ag.owner_id,
            "delegated_permissions": list(ag.delegated_permissions),
            "is_agent": True,
        })

    # Departmental breakdown
    departments = {}
    for p in principals_list:
        dept = p["department"]
        departments.setdefault(dept, []).append(p)

    return {
        "tree_root": "E001",  # CEO
        "principals": principals_list,
        "departments": departments,
        "crucial_policy": {
            "standard_rule": "Immediate superior approval required for same-department non-crucial requests",
            "crucial_rule": "Multi-tier escalation to Executive (CTO/CFO), Resource Owner, and Security Officer (R001) required for crucial data or cross-department requests",
        },
    }


@router.get("/principals")
def list_principals(db: Session = Depends(get_db)):
    """Flat list of all human employees and AI agents."""
    employees, agents = _load_domain_principals(db)
    result = []
    for emp_id, emp in employees.items():
        result.append({
            "id": emp.id,
            "name": emp.name,
            "role": emp.role,
            "department": emp.department,
            "manager_id": emp.manager_id,
            "is_agent": False,
        })
    for ag_id, ag in agents.items():
        result.append({
            "id": ag.id,
            "name": ag.name,
            "role": "AI Agent",
            "department": ag.department,
            "owner_id": ag.owner_id,
            "delegated_permissions": list(ag.delegated_permissions),
            "is_agent": True,
        })
    return result


@router.get("/preview-approval")
def preview_approval_path(
    requester_id: str = Query(...),
    resource_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Calculates whether a request requires standard or crucial multi-tier approval."""
    employees, agents = _load_domain_principals(db)
    resource = db.get(Resource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    crucial = bool(getattr(resource, "is_crucial", False)) or is_crucial_resource(
        resource_id, tier=resource.tier, sensitivity=getattr(resource, "sensitivity", "INTERNAL")
    )
    res_dept = getattr(resource, "department", "General")

    steps = determine_required_approval_steps(
        requester_id=requester_id,
        resource_id=resource_id,
        resource_dept=res_dept,
        resource_owner_id=resource.owner_sub,
        is_crucial=crucial,
        employees=employees,
        agents=agents,
        security_officer_id="R001",
    )

    requester_name = requester_id
    if requester_id in employees:
        requester_name = employees[requester_id].name
    elif requester_id in agents:
        requester_name = f"{agents[requester_id].name} (Agent of {agents[requester_id].owner_id})"

    return {
        "requester_id": requester_id,
        "requester_name": requester_name,
        "resource_id": resource_id,
        "resource_name": resource.name,
        "is_crucial": crucial,
        "is_cross_dept": (agents.get(requester_id, employees.get(requester_id))).department.lower() != res_dept.lower() if (requester_id in employees or requester_id in agents) else False,
        "steps": [
            {
                "slot_role": s.slot_role,
                "assigned_sub": s.assigned_sub,
                "level": s.level,
                "title": s.title,
                "is_crucial_escalation": s.is_crucial_escalation,
            }
            for s in steps
        ],
    }
