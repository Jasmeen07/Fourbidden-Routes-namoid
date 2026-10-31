"""FastAPI Router for ServiceNow SecOps Protection, Incident Management & Monitoring."""
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func

from app.db.engine import get_db
from app.db.models import SecurityEvent, SecurityIncident, IpReputation, ThreatIntelIndicator
from app.auth.deps import get_current_user, UserContext
from app.services.secops import SecOpsService
from app.services.servicenow import ServiceNowService
from app.ids import generate_id

router = APIRouter(prefix="/api/secops", tags=["secops"])


class SimulateWafPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_ip: str | None = None
    method: str = "POST"
    path: str = "/api/resources/finance.csv/query"
    payload: Any = None
    user_sub: str | None = None


class UpdateIncidentPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str
    assigned_to: str | None = None
    note: str | None = None
    resolution_notes: str | None = None


class ContainIncidentPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = "isolate_ip"  # 'isolate_ip'


class BlockIpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ip: str
    reason: str
    is_permanent: bool = False
    duration_seconds: int | None = None


class UnblockIpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ip: str
    reason: str = "Administrative unblock after verification"


class AllowlistIpPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ip: str
    reason: str = "Trusted internal/corporate host"


class CreateThreatIntelPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str  # 'IP', 'DOMAIN', 'URL', 'HASH'
    value: str
    threat_actor: str | None = None
    campaign: str | None = None
    confidence: int = Field(default=85, ge=1, le=100)
    description: str


class ServiceNowWebhookPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event: str | None = None
    sys_id: str | None = None
    number: str | None = None
    correlation_id: str | None = None
    state: str | None = None
    status: str | None = None
    assigned_to: str | None = None
    work_notes: str | None = None
    notes: str | None = None
    resolution_notes: str | None = None
    author: str | None = None


class TestServiceNowPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    violation_code: str = "DENY_PURPOSE_MISMATCH"
    caller_sub: str = "alice"
    resource_id: str = "finance.csv"
    action: str = "query"
    declared_purpose: str = "UNAUTHORIZED_RESEARCH"


@router.get("/summary")
def get_secops_summary(
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Returns high-level SecOps telemetry, open incidents, and threat metrics."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    active_incidents = db.execute(
        select(func.count(SecurityIncident.id)).where(SecurityIncident.status != "CLOSED")
    ).scalar() or 0

    blocked_ips = db.execute(
        select(func.count(IpReputation.ip)).where(
            IpReputation.status.in_(["TEMP_BLOCKED", "PERM_BLOCKED"])
        )
    ).scalar() or 0

    total_events = db.execute(select(func.count(SecurityEvent.id))).scalar() or 0

    attacks_detected = db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.risk_score >= 30)
    ).scalar() or 0

    active_ti = db.execute(
        select(func.count(ThreatIntelIndicator.id)).where(ThreatIntelIndicator.is_active == True)
    ).scalar() or 0

    recent_incidents = db.execute(
        select(SecurityIncident).order_by(desc(SecurityIncident.created_at)).limit(5)
    ).scalars().all()

    return {
        "active_incidents": active_incidents,
        "blocked_ips": blocked_ips,
        "total_security_events": total_events,
        "attacks_detected": attacks_detected,
        "active_threat_intel_count": active_ti,
        "recent_incidents": [
            {
                "id": inc.id,
                "title": inc.title,
                "severity": inc.severity,
                "priority": inc.priority,
                "status": inc.status,
                "source_ip": inc.source_ip,
                "created_at": inc.created_at.isoformat(),
            }
            for inc in recent_incidents
        ],
    }


@router.get("/events")
def list_security_events(
    source_ip: str | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    action: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Returns searchable security history and audit trails."""
    query = select(SecurityEvent)
    if source_ip:
        query = query.where(SecurityEvent.source_ip == source_ip)
    if severity:
        query = query.where(SecurityEvent.severity == severity.upper())
    if category:
        query = query.where(SecurityEvent.category == category.upper())
    if action:
        query = query.where(SecurityEvent.action_taken == action.upper())

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
    events = db.execute(query.order_by(desc(SecurityEvent.timestamp)).offset(offset).limit(limit)).scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "id": ev.id,
                "timestamp": ev.timestamp.isoformat(),
                "source_ip": ev.source_ip,
                "user_sub": ev.user_sub,
                "method": ev.method,
                "path": ev.path,
                "category": ev.category,
                "pattern_matched": ev.pattern_matched,
                "risk_score": ev.risk_score,
                "severity": ev.severity,
                "action_taken": ev.action_taken,
                "repeat_count": ev.repeat_count,
                "incident_id": ev.incident_id,
                "payload_snippet": ev.payload_snippet,
                "status": ev.status,
            }
            for ev in events
        ],
    }


@router.get("/incidents")
def list_incidents(
    status: str | None = Query(None),
    severity: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Lists ServiceNow SIR Security Incidents."""
    query = select(SecurityIncident)
    if status:
        query = query.where(SecurityIncident.status == status.upper())
    if severity:
        query = query.where(SecurityIncident.severity == severity.upper())

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0
    incidents = db.execute(query.order_by(desc(SecurityIncident.created_at)).offset(offset).limit(limit)).scalars().all()

    return {
        "total": total,
        "incidents": [
            {
                "id": inc.id,
                "title": inc.title,
                "description": inc.description,
                "severity": inc.severity,
                "priority": inc.priority,
                "status": inc.status,
                "source_ip": inc.source_ip,
                "user_sub": inc.user_sub,
                "assigned_to": inc.assigned_to,
                "created_at": inc.created_at.isoformat(),
                "updated_at": inc.updated_at.isoformat(),
                "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
                "resolution_notes": inc.resolution_notes,
                "notes_count": len(inc.investigation_notes or []),
                "servicenow_number": inc.servicenow_number,
                "servicenow_sys_id": inc.servicenow_sys_id,
                "webhook_status": inc.webhook_status,
            }
            for inc in incidents
        ],
    }


@router.get("/incidents/{incident_id}")
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Retrieves single incident with complete investigation thread and associated events."""
    incident = db.get(SecurityIncident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

    associated_events = db.execute(
        select(SecurityEvent).where(SecurityEvent.incident_id == incident_id).order_by(desc(SecurityEvent.timestamp))
    ).scalars().all()

    return {
        "id": incident.id,
        "title": incident.title,
        "description": incident.description,
        "severity": incident.severity,
        "priority": incident.priority,
        "status": incident.status,
        "source_ip": incident.source_ip,
        "user_sub": incident.user_sub,
        "assigned_to": incident.assigned_to,
        "created_at": incident.created_at.isoformat(),
        "updated_at": incident.updated_at.isoformat(),
        "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None,
        "resolution_notes": incident.resolution_notes,
        "investigation_notes": incident.investigation_notes or [],
        "servicenow_number": incident.servicenow_number,
        "servicenow_sys_id": incident.servicenow_sys_id,
        "webhook_status": incident.webhook_status,
        "webhook_payload": incident.webhook_payload,
        "associated_events": [
            {
                "id": ev.id,
                "timestamp": ev.timestamp.isoformat(),
                "category": ev.category,
                "pattern": ev.pattern_matched,
                "risk_score": ev.risk_score,
                "severity": ev.severity,
                "action": ev.action_taken,
                "path": ev.path,
            }
            for ev in associated_events
        ],
    }


@router.patch("/incidents/{incident_id}")
def update_incident(
    incident_id: str,
    payload: UpdateIncidentPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Updates incident status and adds investigation notes."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    incident = SecOpsService.update_incident_status(
        db=db,
        incident_id=incident_id,
        status=payload.status,
        actor_sub=user.sub,
        assigned_to=payload.assigned_to,
        note=payload.note,
        resolution_notes=payload.resolution_notes,
        now=now,
    )
    db.commit()
    return {"message": "Incident updated successfully", "incident_id": incident.id, "status": incident.status}


@router.post("/incidents/{incident_id}/contain")
def contain_incident(
    incident_id: str,
    payload: ContainIncidentPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Executes SOAR containment action (e.g. isolate IP)."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    result = SecOpsService.contain_incident(
        db=db,
        incident_id=incident_id,
        containment_action=payload.action,
        actor_sub=user.sub,
        now=now,
    )
    db.commit()
    return {"message": "Containment action executed", "result": result}


@router.get("/ips")
def list_ip_reputations(
    status: str | None = Query(None),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Lists monitored IP reputations and WAF restriction states."""
    query = select(IpReputation)
    if status:
        query = query.where(IpReputation.status == status.upper())
    ips = db.execute(query.order_by(desc(IpReputation.last_seen_at))).scalars().all()

    return {
        "ips": [
            {
                "ip": r.ip,
                "status": r.status,
                "risk_score": r.risk_score,
                "malicious_attempts": r.malicious_attempts,
                "last_seen_at": r.last_seen_at.isoformat(),
                "blocked_until": r.blocked_until.isoformat() if r.blocked_until else None,
                "block_reason": r.block_reason,
                "manual_override": r.manual_override,
            }
            for r in ips
        ]
    }


@router.post("/ips/block")
def block_ip(
    payload: BlockIpPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Administratively blocks an IP address."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    status = "PERM_BLOCKED" if payload.is_permanent else "TEMP_BLOCKED"
    rep = SecOpsService.set_ip_status(
        db=db,
        ip=payload.ip,
        new_status=status,
        reason=payload.reason,
        actor_sub=user.sub,
        duration_seconds=payload.duration_seconds,
        now=now,
    )
    db.commit()
    return {"message": f"IP {payload.ip} set to {status}", "ip": rep.ip, "status": rep.status}


@router.post("/ips/unblock")
def unblock_ip(
    payload: UnblockIpPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Administratively unblocks an IP address."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    rep = SecOpsService.set_ip_status(
        db=db,
        ip=payload.ip,
        new_status="CLEAN",
        reason=payload.reason,
        actor_sub=user.sub,
        duration_seconds=None,
        now=now,
    )
    db.commit()
    return {"message": f"IP {payload.ip} unblocked", "ip": rep.ip, "status": rep.status}


@router.post("/ips/allowlist")
def allowlist_ip(
    payload: AllowlistIpPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Adds an IP address to the trusted allowlist."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    rep = SecOpsService.set_ip_status(
        db=db,
        ip=payload.ip,
        new_status="ALLOWLISTED",
        reason=payload.reason,
        actor_sub=user.sub,
        duration_seconds=None,
        now=now,
    )
    db.commit()
    return {"message": f"IP {payload.ip} added to allowlist", "ip": rep.ip, "status": rep.status}


@router.get("/threat-intel")
def list_threat_intel(
    type: str | None = Query(None),
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Lists external threat intelligence feeds (IoCs)."""
    query = select(ThreatIntelIndicator).where(ThreatIntelIndicator.is_active == True)
    if type:
        query = query.where(ThreatIntelIndicator.type == type.upper())
    tis = db.execute(query.order_by(desc(ThreatIntelIndicator.added_at))).scalars().all()

    return {
        "indicators": [
            {
                "id": ti.id,
                "type": ti.type,
                "value": ti.value,
                "threat_actor": ti.threat_actor,
                "campaign": ti.campaign,
                "confidence": ti.confidence,
                "description": ti.description,
                "added_at": ti.added_at.isoformat(),
            }
            for ti in tis
        ]
    }


@router.post("/threat-intel")
def add_threat_intel(
    payload: CreateThreatIntelPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Adds a new Indicator of Compromise (IoC) to the threat intelligence repository."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    existing = db.execute(
        select(ThreatIntelIndicator).where(ThreatIntelIndicator.value == payload.value)
    ).scalar_one_or_none()

    if existing:
        existing.is_active = True
        existing.confidence = payload.confidence
        existing.description = payload.description
        existing.threat_actor = payload.threat_actor
        existing.campaign = payload.campaign
        ti = existing
    else:
        ti = ThreatIntelIndicator(
            id=generate_id("ioc"),
            type=payload.type.upper(),
            value=payload.value,
            threat_actor=payload.threat_actor,
            campaign=payload.campaign,
            confidence=payload.confidence,
            description=payload.description,
            added_at=now,
            is_active=True,
        )
        db.add(ti)

    db.commit()
    return {"message": "Threat intelligence indicator added", "id": ti.id, "value": ti.value}


@router.post("/simulate")
def simulate_waf_attack(
    payload: SimulateWafPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Interactive WAF Attack Simulation & Detection Console.

    Tests attack vectors (SQLi, XSS, Command Injection, Path Traversal, Threat Intel IP)
    and demonstrates real-time risk scoring, containment, and incident creation.
    """
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    source_ip = payload.source_ip or "198.51.100.99"
    effective_user = payload.user_sub or user.sub

    result = SecOpsService.inspect_and_record(
        db=db,
        ip=source_ip,
        method=payload.method,
        path=payload.path,
        payload_data=payload.payload,
        user_sub=effective_user,
        now=now,
    )
    db.commit()
    return result


@router.get("/servicenow/status")
def get_servicenow_status(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Returns ServiceNow integration adapter status, configuration, and recent SIR dispatches."""
    return ServiceNowService.get_status(db=db)


@router.post("/servicenow/webhook")
def receive_servicenow_webhook(
    payload: ServiceNowWebhookPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    """Inbound webhook receiver for updates from external ServiceNow SecOps instance."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    try:
        incident = ServiceNowService.handle_incoming_webhook(
            db=db,
            payload=payload.model_dump(exclude_unset=True),
            now=now,
        )
        db.commit()
        return {
            "status": "acknowledged",
            "incident_id": incident.id,
            "servicenow_number": incident.servicenow_number,
            "incident_status": incident.status,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/servicenow/test")
def test_servicenow_dispatch(
    payload: TestServiceNowPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Test utility to trigger an automated ServiceNow SIR incident dispatch from synthetic PDP violation."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    client_ip = request.client.host if request.client else "127.0.0.1"

    synthetic_trace = [
        {"check_name": "session_identity", "status": "pass", "detail": f"Authenticated subject {payload.caller_sub}"},
        {"check_name": "grant_exists", "status": "pass", "detail": "Grant found"},
        {"check_name": "purpose_matches", "status": "fail", "detail": f"Declared purpose '{payload.declared_purpose}' violates grant purpose"},
    ]

    incident = ServiceNowService.auto_open_sir_incident(
        db=db,
        violation_code=payload.violation_code,
        caller_sub=payload.caller_sub,
        resource_id=payload.resource_id,
        action=payload.action,
        declared_purpose=payload.declared_purpose,
        pdp_trace=synthetic_trace,
        client_ip=client_ip,
        now=now,
    )
    db.commit()

    return {
        "message": "ServiceNow SIR incident auto-opened and dispatched",
        "incident_id": incident.id,
        "servicenow_number": incident.servicenow_number,
        "servicenow_sys_id": incident.servicenow_sys_id,
        "webhook_status": incident.webhook_status,
        "payload_dispatched": incident.webhook_payload,
    }
