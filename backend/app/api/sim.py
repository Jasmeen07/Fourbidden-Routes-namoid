"""Simulation Gateway invocation API (BLUEPRINT §6.6, §8)."""
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from app.db.engine import get_db
from app.db.models import Grant
from app.auth.deps import get_current_user, UserContext
from app.services.gateway import SimulationGateway

router = APIRouter(prefix="/api/sim", tags=["simulation"])


class InvokePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str
    declared_purpose: str
    input: Any = None


class SimInvokePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str
    declared_purpose: str
    grant_id: str | None = None
    resource_id: str | None = None
    client_ip: str | None = None
    caller_sub: str | None = None
    target_destination: str | None = None
    event_id: str | None = None
    payload: Any = None
    input: Any = None


@router.post("/resources/{resource_id}/invoke")
def invoke_resource(
    resource_id: str,
    payload: InvokePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    result = SimulationGateway.invoke(
        db=db,
        resource_id=resource_id,
        action=payload.action,
        declared_purpose=payload.declared_purpose,
        caller_sub=user.sub,
        input_data=payload.input,
        now=now,
    )
    db.commit()
    return result


@router.post("/invoke")
def invoke_simulator(
    payload: SimInvokePayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """PEP Simulator invocation endpoint with rich decision trace formatting."""
    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    resource_id = payload.resource_id
    if not resource_id and payload.grant_id:
        grant = db.get(Grant, payload.grant_id)
        if grant:
            resource_id = grant.resource_id

    if not resource_id:
        raise HTTPException(status_code=400, detail="Target resource_id could not be resolved from payload or grant.")

    effective_caller = payload.caller_sub or user.sub
    input_data = payload.payload if payload.payload is not None else payload.input
    result = SimulationGateway.invoke(
        db=db,
        resource_id=resource_id,
        action=payload.action,
        declared_purpose=payload.declared_purpose,
        caller_sub=effective_caller,
        input_data=input_data,
        now=now,
        target_destination=payload.target_destination,
        event_id=payload.event_id,
    )
    db.commit()

    is_allow = result["decision"]["allow"]
    decision_code = result["decision"]["code"]
    is_violation = result["decision"].get("violation", False)

    steps = [
        {
            "check": t["check_name"],
            "status": "PASS" if t["status"] == "PASS" else "FAIL",
            "detail": t["detail"],
            "timestamp": now.isoformat(),
        }
        for t in result["decision"]["trace"]
    ]

    mock_resp = None
    if is_allow and result.get("output"):
        mock_resp = {
            "watermark": f"WATERMARK-SANDBOX-{resource_id}-{now.strftime('%Y%m%d%H%M')}",
            "resource_id": resource_id,
            "action": payload.action,
            "payload_preview": result["output"],
        }

    trace_obj = {
        "decision": "ALLOW" if is_allow else "DENY",
        "grant_id": payload.grant_id,
        "subject_id": user.sub,
        "resource_id": resource_id,
        "action": payload.action,
        "purpose": payload.declared_purpose,
        "steps": steps,
        "timestamp": now.isoformat(),
        "denial_reason": decision_code if not is_allow else None,
        "mock_response": mock_resp,
    }

    return {
        "decision": trace_obj["decision"],
        "code": decision_code,
        "violation": is_violation,
        "decision_trace": trace_obj,
        "output": result.get("output"),
    }


@router.get("/violations")
def list_recent_violations(
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Innovation 4: Purpose-Bound Access Violation stream."""
    from sqlalchemy import select
    from app.db.models import AuditEvent

    stmt = select(AuditEvent).where(AuditEvent.type == "ACCESS_DENIED").order_by(AuditEvent.seq.desc()).limit(20)
    events = db.execute(stmt).scalars().all()
    violations = []
    for ev in events:
        payload = ev.payload or {}
        if payload.get("violation") or payload.get("decision_code") in ["DENY_PURPOSE_MISMATCH", "DENY_ACTION_NOT_GRANTED"]:
            violations.append({
                "seq": ev.seq,
                "ts": ev.ts.isoformat(),
                "actor_sub": ev.actor_sub,
                "resource_id": payload.get("resource_id"),
                "action": payload.get("action"),
                "declared_purpose": payload.get("declared_purpose"),
                "decision_code": payload.get("decision_code"),
                "grant_id": payload.get("grant_id"),
            })
    return violations
