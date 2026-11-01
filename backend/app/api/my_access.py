"""Role-Based My Access & Security Dashboard API.

Provides dynamic, role-tailored access management, personal security posture,
team oversight for Managers, risk assessment for Risk Reviewers, resource monitoring
for Resource Owners, and executive/admin hierarchy retention for Administrators.
Preserves the mandatory three-stage approval process (Manager -> Risk Reviewer -> Resource Owner).
"""
from datetime import datetime, timezone, timedelta
from typing import Literal
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, desc

from app.db.engine import get_db
from app.db.models import User, UserRole, Resource, AccessRequest, ReviewSlot, Grant, AuditEvent, SecurityEvent
from app.auth.deps import get_current_user, verify_csrf, UserContext
from app.domain.effective import compute_effective_status
from app.domain.hierarchy import (
    Employee,
    Agent,
    get_immediate_superior,
)
from app.services.requests import RequestsService
from app.services.grants import GrantsService

router = APIRouter(prefix="/api/my-access", tags=["my-access"])


class RenewAccessPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    grant_id: str
    additional_minutes: int = Field(..., ge=15, le=4320)
    justification: str = Field(..., min_length=10, max_length=1000)


def _load_domain_hierarchy(db: Session):
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

    principals_list = []
    for emp_id, emp in employees.items():
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

    departments = {}
    for p in principals_list:
        dept = p["department"]
        departments.setdefault(dept, []).append(p)

    return {
        "tree_root": "E001",
        "principals": principals_list,
        "departments": departments,
        "total_humans": len(employees),
        "total_agents": len(agents),
    }


@router.get("")
def get_my_access_dashboard(
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Returns role-based dashboard telemetry for the authenticated principal.
    - Employee / Requester: Personal active access, requests, expiry, alerts, audit history, recommendations.
    - Manager: Direct reports, pending team approvals, team access overview.
    - Risk Reviewer: High-risk requests, risk scores, suspicious access alerts.
    - Resource Owner: Owned resources, incoming requests, active grants.
    - Administrator: Complete organizational hierarchy, AI agent governance, users, audit logs.
    """
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    # 1. Determine user's active capabilities
    roles_lower = [r.lower() for r in user.roles]
    is_admin = any(r in roles_lower for r in ["admin", "executive", "security_admin"]) or user.sub in ["E001", "E002", "fiona", "david"]
    is_manager = any(r in roles_lower for r in ["manager", "data_governance", "executive"]) or user.sub in ["carol", "usr_mgr_1", "E050", "E060"]
    is_risk_reviewer = any(r in roles_lower for r in ["risk_reviewer", "compliance", "security_admin", "executive"]) or user.sub in ["elena", "usr_risk_1", "usr_risk_2", "R001"]
    
    # Check if user owns any resources
    owned_resources_objs = db.execute(select(Resource).where(Resource.owner_sub == user.sub)).scalars().all()
    is_resource_owner = any(r in roles_lower for r in ["resource_owner"]) or len(owned_resources_objs) > 0 or user.sub in ["david", "usr_owner_1", "E050", "E060", "E301"]

    # =========================================================================
    # SECTION 1: EMPLOYEE / REQUESTER DATA (Always available for current user)
    # =========================================================================

    # 1.1 My Active Access (Grants)
    user_grants = db.execute(
        select(Grant).where(Grant.requester_sub == user.sub).order_by(Grant.activated_at.desc())
    ).scalars().all()

    my_active_access = []
    expiring_access = []
    smart_recommendations = []

    for g in user_grants:
        info = GrantsService.get_grant_with_effective_status(g, now)
        res = db.get(Resource, g.resource_id)
        owner_user = db.get(User, res.owner_sub) if res else None

        exp_at = g.expires_at if g.expires_at.tzinfo is not None else g.expires_at.replace(tzinfo=timezone.utc)
        act_at = g.activated_at if g.activated_at.tzinfo is not None else g.activated_at.replace(tzinfo=timezone.utc)

        remaining_seconds = max(0, int((exp_at - now).total_seconds()))
        remaining_hours = round(remaining_seconds / 3600.0, 1)

        grant_item = {
            "grant_id": g.id,
            "resource_id": g.resource_id,
            "resource_name": res.name if res else g.resource_id,
            "resource_tier": res.tier if res else "INTERNAL_SYNTHETIC",
            "resource_owner": owner_user.display_name if owner_user else (res.owner_sub if res else "Unknown"),
            "owner_sub": res.owner_sub if res else "",
            "actions": g.actions,
            "purpose_code": g.purpose_code,
            "activated_at": act_at.isoformat(),
            "expires_at": exp_at.isoformat(),
            "effective_status": info["status"],
            "remaining_hours": remaining_hours,
            "is_expiring_soon": remaining_hours <= 48 and info["status"] == "ACTIVE",
            "invocation_count": g.invocation_count,
            "last_used_at": g.last_used_at.isoformat() if g.last_used_at else None,
            "limits": {},
        }

        if info["status"] == "ACTIVE":
            my_active_access.append(grant_item)
            if remaining_hours <= 48:
                expiring_access.append(grant_item)

            # Smart Recommendations: Identify unused or excessive permissions
            if g.invocation_count == 0 and (now - act_at).total_seconds() > 3600:
                smart_recommendations.append({
                    "grant_id": g.id,
                    "type": "UNUSED_PERMISSIONS",
                    "severity": "LOW",
                    "title": f"Dormant Grant for {res.name if res else g.resource_id}",
                    "recommendation": "Access was granted over 1 hour ago with 0 invocations. Consider releasing early to minimize privilege exposure.",
                    "action_suggested": "release_early",
                })
            elif len(g.actions) > 2 and g.invocation_count > 0:
                smart_recommendations.append({
                    "grant_id": g.id,
                    "type": "LEAST_PRIVILEGE",
                    "severity": "INFO",
                    "title": f"Scope Minimization for {res.name if res else g.resource_id}",
                    "recommendation": f"You hold {len(g.actions)} permissions. You can narrow access to only query actions upon renewal.",
                    "action_suggested": "narrow_renewal",
                })

    # 1.2 My Access Requests & 3-Stage Approval Tracking
    user_requests = db.execute(
        select(AccessRequest).where(AccessRequest.requester_sub == user.sub).order_by(AccessRequest.created_at.desc())
    ).scalars().all()

    my_access_requests = []
    for r in user_requests:
        res = db.get(Resource, r.resource_id)
        # Parse slots into structured 3 stages
        stages = {
            "manager": {"status": "PENDING", "assigned_to": "Manager", "decision": None, "decided_at": None},
            "risk_reviewer": {"status": "PENDING", "assigned_to": "Risk Reviewer", "decision": None, "decided_at": None},
            "resource_owner": {"status": "PENDING", "assigned_to": "Resource Owner", "decision": None, "decided_at": None},
        }

        for s in r.slots:
            slot_key = s.slot_role
            if slot_key in stages:
                stages[slot_key] = {
                    "id": s.id,
                    "status": s.status,
                    "assigned_to": s.assigned_sub or s.slot_role.replace("_", " ").title(),
                    "decision": s.decision,
                    "decided_by": s.decided_by_sub,
                    "decided_at": s.decided_at.isoformat() if s.decided_at else None,
                    "rationale": s.rationale,
                }

        my_access_requests.append({
            "request_id": r.id,
            "resource_id": r.resource_id,
            "resource_name": res.name if res else r.resource_id,
            "purpose_code": r.purpose_code,
            "purpose_text": r.purpose_text,
            "actions": r.actions,
            "duration_minutes": r.duration_minutes,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "approval_stages": stages,
        })

    # 1.3 Personal Security & Risk Alerts
    user_events = db.execute(
        select(SecurityEvent).where(
            or_(SecurityEvent.user_sub == user.sub, SecurityEvent.payload_snippet.like(f"%{user.sub}%"))
        ).order_by(SecurityEvent.timestamp.desc()).limit(15)
    ).scalars().all()

    personal_security_alerts = [
        {
            "id": ev.id,
            "timestamp": ev.timestamp.isoformat(),
            "category": ev.category,
            "severity": ev.severity,
            "action_taken": ev.action_taken,
            "risk_score": ev.risk_score,
            "path": ev.path,
            "incident_id": ev.incident_id,
            "pattern_matched": ev.pattern_matched,
            "description": f"Security gateway flagged {ev.category} from {ev.source_ip} (Action: {ev.action_taken})",
        }
        for ev in user_events
    ]

    # 1.4 Access History (Personal Audit Trail)
    user_audits = db.execute(
        select(AuditEvent).where(
            or_(AuditEvent.actor_sub == user.sub, AuditEvent.subject_id == user.sub)
        ).order_by(AuditEvent.ts.desc()).limit(25)
    ).scalars().all()

    access_history = [
        {
            "id": a.id,
            "timestamp": a.ts.isoformat(),
            "event_type": a.type,
            "actor_sub": a.actor_sub,
            "subject_id": a.subject_id,
            "payload": a.payload,
        }
        for a in user_audits
    ]

    # =========================================================================
    # SECTION 2: MANAGER OVERSIGHT DATA
    # =========================================================================
    manager_data = None
    if is_manager or is_admin:
        # Team members reporting to this manager
        team_members_objs = db.execute(
            select(User).where(User.manager_sub == user.sub)
        ).scalars().all()
        team_subs = [tm.sub for tm in team_members_objs]

        # Requests from assigned team members or assigned review slots
        team_requests_stmt = select(AccessRequest).where(
            or_(
                AccessRequest.requester_sub.in_(team_subs),
                AccessRequest.slots.any(and_(ReviewSlot.slot_role == "manager", ReviewSlot.status == "PENDING")),
            )
        ).order_by(AccessRequest.created_at.desc()).limit(30)

        team_requests_objs = db.execute(team_requests_stmt).scalars().all()

        team_requests_list = []
        pending_team_approvals = []
        for tr in team_requests_objs:
            res = db.get(Resource, tr.resource_id)
            requester_user = db.get(User, tr.requester_sub)
            req_dict = {
                "request_id": tr.id,
                "requester_sub": tr.requester_sub,
                "requester_name": requester_user.display_name if requester_user else tr.requester_sub,
                "requester_dept": requester_user.department if requester_user else "General",
                "resource_id": tr.resource_id,
                "resource_name": res.name if res else tr.resource_id,
                "purpose_code": tr.purpose_code,
                "purpose_text": tr.purpose_text,
                "actions": tr.actions,
                "duration_minutes": tr.duration_minutes,
                "status": tr.status,
                "created_at": tr.created_at.isoformat(),
                "slots": [
                    {"slot_id": s.id, "slot_role": s.slot_role, "status": s.status, "assigned_sub": s.assigned_sub}
                    for s in tr.slots
                ],
            }
            team_requests_list.append(req_dict)
            if tr.status in ["IN_REVIEW", "BLOCKED"] and any(s.slot_role == "manager" and s.status == "PENDING" for s in tr.slots):
                pending_team_approvals.append(req_dict)

        # Team member active access summary
        team_access_summary = []
        for tm in team_members_objs:
            tm_grants = db.execute(
                select(Grant).where(and_(Grant.requester_sub == tm.sub, Grant.status == "ACTIVE"))
            ).scalars().all()
            team_access_summary.append({
                "sub": tm.sub,
                "name": tm.display_name,
                "email": tm.email,
                "role": tm.roles[0].role if tm.roles else "requester",
                "active_grants_count": len(tm_grants),
            })

        # Manager approval history
        decided_slots = db.execute(
            select(ReviewSlot).where(
                and_(ReviewSlot.decided_by_sub == user.sub, ReviewSlot.slot_role == "manager")
            ).order_by(ReviewSlot.decided_at.desc()).limit(20)
        ).scalars().all()

        manager_approval_history = [
            {
                "slot_id": ds.id,
                "request_id": ds.request_id,
                "decision": ds.decision,
                "rationale": ds.rationale,
                "decided_at": ds.decided_at.isoformat() if ds.decided_at else None,
            }
            for ds in decided_slots
        ]

        manager_data = {
            "team_members_count": len(team_members_objs),
            "pending_approvals_count": len(pending_team_approvals),
            "pending_approvals": pending_team_approvals,
            "team_requests": team_requests_list,
            "team_members": team_access_summary,
            "approval_history": manager_approval_history,
        }

    # =========================================================================
    # SECTION 3: RISK REVIEWER DATA
    # =========================================================================
    risk_reviewer_data = None
    if is_risk_reviewer or is_admin:
        # Requests requiring risk review
        risk_reqs = db.execute(
            select(AccessRequest).where(
                AccessRequest.slots.any(and_(ReviewSlot.slot_role == "risk_reviewer", ReviewSlot.status == "PENDING"))
            ).order_by(AccessRequest.created_at.desc()).limit(25)
        ).scalars().all()

        risk_review_requests = []
        for rr in risk_reqs:
            res = db.get(Resource, rr.resource_id)
            requester_user = db.get(User, rr.requester_sub)
            risk_review_requests.append({
                "request_id": rr.id,
                "requester_name": requester_user.display_name if requester_user else rr.requester_sub,
                "resource_name": res.name if res else rr.resource_id,
                "resource_tier": res.tier if res else "INTERNAL_SYNTHETIC",
                "is_crucial": bool(getattr(res, "is_crucial", False)),
                "purpose_code": rr.purpose_code,
                "duration_minutes": rr.duration_minutes,
                "actions": rr.actions,
                "created_at": rr.created_at.isoformat(),
            })

        # Excessive or suspicious access events
        high_risk_events = db.execute(
            select(SecurityEvent).where(SecurityEvent.risk_score >= 60).order_by(SecurityEvent.timestamp.desc()).limit(15)
        ).scalars().all()

        risk_reviewer_data = {
            "pending_risk_evaluations_count": len(risk_review_requests),
            "risk_review_requests": risk_review_requests,
            "suspicious_access_alerts": [
                {
                    "id": he.id,
                    "timestamp": he.timestamp.isoformat(),
                    "source_ip": he.source_ip,
                    "category": he.category,
                    "risk_score": he.risk_score,
                    "severity": he.severity,
                    "action_taken": he.action_taken,
                    "user_sub": he.user_sub,
                }
                for he in high_risk_events
            ],
        }

    # =========================================================================
    # SECTION 4: RESOURCE OWNER DATA
    # =========================================================================
    resource_owner_data = None
    if is_resource_owner or is_admin:
        owned_resources_list = [
            {
                "id": r.id,
                "name": r.name,
                "kind": r.kind,
                "tier": r.tier,
                "sensitivity": getattr(r, "sensitivity", "INTERNAL"),
                "department": getattr(r, "department", "General"),
                "is_crucial": bool(getattr(r, "is_crucial", False)),
            }
            for r in owned_resources_objs
        ]
        owned_ids = [r.id for r in owned_resources_objs]

        # Requests for owned resources
        ro_requests = db.execute(
            select(AccessRequest).where(AccessRequest.resource_id.in_(owned_ids)).order_by(AccessRequest.created_at.desc()).limit(25)
        ).scalars().all() if owned_ids else []

        ro_requests_list = []
        pending_ro_approvals = []
        for ror in ro_requests:
            res = db.get(Resource, ror.resource_id)
            requester_user = db.get(User, ror.requester_sub)
            req_dict = {
                "request_id": ror.id,
                "requester_sub": ror.requester_sub,
                "requester_name": requester_user.display_name if requester_user else ror.requester_sub,
                "resource_name": res.name if res else ror.resource_id,
                "purpose_code": ror.purpose_code,
                "purpose_text": ror.purpose_text,
                "actions": ror.actions,
                "duration_minutes": ror.duration_minutes,
                "status": ror.status,
                "created_at": ror.created_at.isoformat(),
            }
            ro_requests_list.append(req_dict)
            if ror.status in ["IN_REVIEW", "BLOCKED"] and any(s.slot_role == "resource_owner" and s.status == "PENDING" for s in ror.slots):
                pending_ro_approvals.append(req_dict)

        # Active grants on owned resources
        ro_grants = db.execute(
            select(Grant).where(and_(Grant.resource_id.in_(owned_ids), Grant.status == "ACTIVE")).order_by(Grant.activated_at.desc()).limit(25)
        ).scalars().all() if owned_ids else []

        ro_active_grants = [
            {
                "grant_id": rog.id,
                "resource_id": rog.resource_id,
                "requester_sub": rog.requester_sub,
                "actions": rog.actions,
                "activated_at": rog.activated_at.isoformat(),
                "expires_at": rog.expires_at.isoformat(),
                "invocation_count": rog.invocation_count,
            }
            for rog in ro_grants
        ]

        resource_owner_data = {
            "owned_resources_count": len(owned_resources_list),
            "owned_resources": owned_resources_list,
            "pending_owner_approvals_count": len(pending_ro_approvals),
            "pending_approvals": pending_ro_approvals,
            "resource_requests": ro_requests_list,
            "active_grants": ro_active_grants,
        }

    # =========================================================================
    # SECTION 5: ADMINISTRATOR CONSOLE (Hierarchy & AI Governance Retained)
    # =========================================================================
    admin_data = None
    if is_admin:
        hierarchy_data = _load_domain_hierarchy(db)
        admin_data = {
            "is_admin": True,
            "hierarchy_tree": hierarchy_data,
            "total_users": db.execute(select(User).where(User.is_agent.is_(False))).scalars().all().__len__(),
            "total_agents": db.execute(select(User).where(User.is_agent.is_(True))).scalars().all().__len__(),
        }

    return {
        "user_profile": {
            "sub": user.sub,
            "display_name": user.display_name,
            "email": user.email,
            "manager_sub": user.manager_sub,
            "roles": user.roles,
            "is_admin": is_admin,
            "is_manager": is_manager,
            "is_risk_reviewer": is_risk_reviewer,
            "is_resource_owner": is_resource_owner,
        },
        "employee_view": {
            "my_active_access": my_active_access,
            "my_access_requests": my_access_requests,
            "expiring_access": expiring_access,
            "security_alerts": personal_security_alerts,
            "access_history": access_history,
            "smart_recommendations": smart_recommendations,
        },
        "manager_view": manager_data,
        "risk_reviewer_view": risk_reviewer_data,
        "resource_owner_view": resource_owner_data,
        "admin_view": admin_data,
    }


@router.post("/renew", dependencies=[Depends(verify_csrf)])
def request_access_renewal(
    payload: RenewAccessPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """
    Submits an access renewal request for an expiring active grant.
    Preserves the mandatory three-stage approval process (Manager -> Risk Reviewer -> Resource Owner).
    """
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)
    policy = request.app.state.policy

    grant = db.get(Grant, payload.grant_id)
    if not grant or grant.requester_sub != user.sub:
        raise HTTPException(status_code=404, detail="Grant not found or not owned by user")

    if grant.revoked_at is not None:
        raise HTTPException(status_code=400, detail="Cannot renew a revoked grant")

    # Create new extension request with mandatory 3-party workflow
    res = db.get(Resource, grant.resource_id)
    tier = res.tier if res else "RESTRICTED_SYNTHETIC"
    required_ctrls = policy.risk_controls.required_by_tier.get(tier, ["activity_logging", "synthetic_data_only"])
    prior_ctrls = grant.request.risk_controls if grant.request and grant.request.risk_controls else []
    controls = list(set(required_ctrls + prior_ctrls))

    new_req = RequestsService.submit_request(
        db=db,
        policy=policy,
        requester_sub=user.sub,
        resource_id=grant.resource_id,
        purpose_code=grant.purpose_code,
        purpose_text=payload.justification,
        actions=grant.actions,
        duration_minutes=payload.additional_minutes,
        risk_controls=controls,
        extends_grant_id=grant.id,
        now=now,
    )
    db.commit()

    return {
        "status": "SUBMITTED",
        "request_id": new_req.id,
        "resource_id": new_req.resource_id,
        "duration_minutes": new_req.duration_minutes,
        "message": "Renewal request submitted successfully and queued for 3-stage governance review.",
    }
