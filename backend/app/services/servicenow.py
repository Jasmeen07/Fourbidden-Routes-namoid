"""ServiceNow Security Operations (SecOps) SIR Integration Adapter & Webhook Dispatcher.

Handles automated incident creation in ServiceNow on Policy Decision Point (PDP)
security violations, outbound webhook dispatching, and inbound webhook synchronisation.
Conforms strictly to AGENTS.md Rules 2-8.
"""
from datetime import datetime, timezone
from typing import Any
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func

from app.config import settings
from app.ids import generate_id
from app.db.models import SecurityIncident, SecurityEvent, Resource, User
from app.domain.servicenow import format_servicenow_sir_payload, map_pdp_violation_to_sir_priority
from app.services.audit import AuditService


class ServiceNowService:
    @staticmethod
    def auto_open_sir_incident(
        db: Session,
        violation_code: str,
        caller_sub: str,
        resource_id: str,
        action: str,
        declared_purpose: str | None,
        pdp_trace: list[dict[str, Any]],
        client_ip: str | None = None,
        now: datetime | None = None,
    ) -> SecurityIncident:
        """Auto-opens a ServiceNow SIR Security Incident upon PDP security policy violation."""
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        # 1. Resolve resource tier if available
        res = db.get(Resource, resource_id)
        resource_tier = res.tier if res else None

        # 2. Generate unique incident ID
        # Format: INC-2026-XXXXX
        raw_seed = f"{caller_sub}-{resource_id}-{current_time.isoformat()}"
        inc_suffix = abs(hash(raw_seed)) % 90000 + 10000
        incident_id = f"INC-2026-{inc_suffix}"

        # 3. Format pure ServiceNow SIR payload
        sir_payload = format_servicenow_sir_payload(
            incident_number=incident_id,
            violation_code=violation_code,
            caller_sub=caller_sub,
            resource_id=resource_id,
            action=action,
            declared_purpose=declared_purpose,
            pdp_trace=pdp_trace,
            now=current_time,
            client_ip=client_ip,
            resource_tier=resource_tier,
        )

        # 4. Outbound Webhook Dispatch
        servicenow_sys_id = f"sn_sys_{generate_id('sys')[:16]}"
        servicenow_number = f"SIR00{abs(hash(current_time.isoformat() + incident_id)) % 90000 + 10000}"
        webhook_status = "MOCKED"

        if settings.SERVICENOW_ENABLED:
            if settings.SERVICENOW_WEBHOOK_URL and not settings.SERVICENOW_MOCK_MODE:
                try:
                    resp = httpx.post(
                        settings.SERVICENOW_WEBHOOK_URL,
                        json=sir_payload,
                        timeout=5.0,
                    )
                    if resp.status_code in (200, 201):
                        webhook_status = "DISPATCHED"
                        data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                        if "result" in data and isinstance(data["result"], dict):
                            servicenow_sys_id = data["result"].get("sys_id", servicenow_sys_id)
                            servicenow_number = data["result"].get("number", servicenow_number)
                    else:
                        webhook_status = "FAILED"
                except Exception:
                    webhook_status = "FAILED"
            else:
                # Deterministic simulation / mock dispatch
                webhook_status = "DISPATCHED"

        # 5. Severity & Priority mapping
        sev_label = "CRITICAL" if "1 - Critical" in sir_payload["severity"] else "HIGH" if "2 - High" in sir_payload["severity"] else "MEDIUM"
        prio_label = "P1" if "1 - Critical" in sir_payload["priority"] else "P2" if "2 - High" in sir_payload["priority"] else "P3"

        # 5b. Safely resolve foreign key for user_sub
        user_record = db.get(User, caller_sub)
        effective_user_sub = caller_sub if user_record else None

        # 6. Create SecurityIncident record in DB
        incident = SecurityIncident(
            id=incident_id,
            title=f"PDP Security Violation: {violation_code} on {resource_id}",
            description=sir_payload["description"],
            severity=sev_label,
            priority=prio_label,
            status="NEW",
            source_ip=client_ip or "127.0.0.1",
            user_sub=effective_user_sub,
            assigned_to=None,
            created_at=current_time,
            updated_at=current_time,
            investigation_notes=[
                {
                    "note_id": generate_id("note"),
                    "timestamp": current_time.isoformat(),
                    "author": "Enterprise SIR Integration Adapter",
                    "text": (
                        f"Automated incident opened from Policy Decision Point (PDP) breach.\n"
                        f"External Incident Reference: {servicenow_number} (sys_id: {servicenow_sys_id}).\n"
                        f"Webhook Delivery Status: {webhook_status}.\n"
                        f"Category: {sir_payload['category']} &bull; Priority: {prio_label}."
                    ),
                }
            ],
            servicenow_sys_id=servicenow_sys_id,
            servicenow_number=servicenow_number,
            webhook_status=webhook_status,
            webhook_payload=sir_payload,
        )
        db.add(incident)

        # 7. Create SecurityEvent record
        sec_event = SecurityEvent(
            id=generate_id("sec"),
            timestamp=current_time,
            source_ip=client_ip or "127.0.0.1",
            user_sub=effective_user_sub,
            method="INVOKE",
            path=f"/api/resources/{resource_id}/invoke",
            category="PDP_SECURITY_VIOLATION",
            pattern_matched=violation_code,
            risk_score=95 if sev_label == "CRITICAL" else 75,
            severity=sev_label,
            action_taken="BLOCKED",
            repeat_count=1,
            incident_id=incident.id,
            payload_snippet=f"Action: {action} | Purpose: {declared_purpose or 'None'}",
            status="OPENED_IN_SERVICENOW",
        )
        db.add(sec_event)

        # 8. Record audit event in the SAME database transaction (AGENTS.md Rule 5)
        # Sanitized payload with no sensitive keys ('token', 'password', 'secret', 'key')
        AuditService.append_event(
            session=db,
            event_type="SERVICENOW_SIR_OPENED",
            subject_type="incident",
            subject_id=incident.id,
            payload={
                "incident_number": incident.id,
                "servicenow_num": servicenow_number,
                "violation_code": violation_code,
                "target_resource": resource_id,
                "attempted_action": action,
                "declared_purpose": declared_purpose or "NONE",
                "integration_status": webhook_status,
            },
            actor_sub=caller_sub,
            now=current_time,
        )

        db.flush()
        return incident

    @staticmethod
    def handle_incoming_webhook(
        db: Session,
        payload: dict[str, Any],
        now: datetime | None = None,
    ) -> SecurityIncident:
        """Processes incoming status updates from ServiceNow SecOps webhook."""
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        # Match by correlation_id (GrantGate incident id), servicenow_number, or sys_id
        corr_id = payload.get("correlation_id") or payload.get("incident_id")
        sn_number = payload.get("number") or payload.get("servicenow_number")
        sn_sys_id = payload.get("sys_id")

        incident: SecurityIncident | None = None
        if corr_id:
            incident = db.get(SecurityIncident, corr_id)
        if not incident and sn_number:
            incident = db.execute(
                select(SecurityIncident).where(SecurityIncident.servicenow_number == sn_number)
            ).scalar_one_or_none()
        if not incident and sn_sys_id:
            incident = db.execute(
                select(SecurityIncident).where(SecurityIncident.servicenow_sys_id == sn_sys_id)
            ).scalar_one_or_none()

        if not incident:
            raise ValueError(f"No corresponding GrantGate incident found for correlation_id={corr_id}, number={sn_number}")

        # Map state code
        state_map = {
            "1": "NEW",
            "2": "INVESTIGATING",
            "3": "CONTAINED",
            "6": "RESOLVED",
            "7": "CLOSED",
            "NEW": "NEW",
            "INVESTIGATING": "INVESTIGATING",
            "CONTAINED": "CONTAINED",
            "RESOLVED": "RESOLVED",
            "CLOSED": "CLOSED",
        }
        new_state = payload.get("state") or payload.get("status")
        mapped_status = state_map.get(str(new_state).upper(), incident.status)

        incident.status = mapped_status
        incident.updated_at = current_time

        assigned_to = payload.get("assigned_to")
        if assigned_to:
            incident.assigned_to = assigned_to

        work_notes = payload.get("work_notes") or payload.get("notes") or payload.get("note")
        resolution_notes = payload.get("resolution_notes")

        if resolution_notes:
            incident.resolution_notes = resolution_notes
            incident.resolved_at = current_time

        notes_list = list(incident.investigation_notes or [])
        note_text = work_notes or f"Incident state updated to {mapped_status}."
        notes_list.append({
            "note_id": generate_id("note"),
            "timestamp": current_time.isoformat(),
            "author": payload.get("author") or "Enterprise SIR Webhook",
            "text": note_text,
        })
        incident.investigation_notes = notes_list
        incident.webhook_status = "ACKNOWLEDGED"

        # Record audit event in same transaction
        AuditService.append_event(
            session=db,
            event_type="SERVICENOW_WEBHOOK_PROCESSED",
            subject_type="incident",
            subject_id=incident.id,
            payload={
                "incident_number": incident.id,
                "servicenow_num": incident.servicenow_number or "UNKNOWN",
                "updated_status": mapped_status,
                "webhook_action": "STATUS_SYNC",
            },
            actor_sub=payload.get("author") or "servicenow_webhook",
            now=current_time,
        )

        db.flush()
        return incident

    @staticmethod
    def get_status(db: Session) -> dict[str, Any]:
        """Returns ServiceNow integration status and telemetry."""
        total_opened = db.execute(
            select(func.count(SecurityIncident.id)).where(SecurityIncident.servicenow_number.isnot(None))
        ).scalar() or 0

        dispatched_count = db.execute(
            select(func.count(SecurityIncident.id)).where(SecurityIncident.webhook_status.in_(["DISPATCHED", "ACKNOWLEDGED", "MOCKED"]))
        ).scalar() or 0

        recent_sn_incidents = db.execute(
            select(SecurityIncident)
            .where(SecurityIncident.servicenow_number.isnot(None))
            .order_by(desc(SecurityIncident.created_at))
            .limit(10)
        ).scalars().all()

        return {
            "enabled": settings.SERVICENOW_ENABLED,
            "mock_mode": settings.SERVICENOW_MOCK_MODE,
            "instance_url": settings.SERVICENOW_INSTANCE_URL,
            "webhook_configured": bool(settings.SERVICENOW_WEBHOOK_URL),
            "table": settings.SERVICENOW_TABLE,
            "total_incidents_opened": total_opened,
            "total_dispatched": dispatched_count,
            "recent_incidents": [
                {
                    "id": inc.id,
                    "title": inc.title,
                    "servicenow_number": inc.servicenow_number,
                    "servicenow_sys_id": inc.servicenow_sys_id,
                    "status": inc.status,
                    "severity": inc.severity,
                    "priority": inc.priority,
                    "webhook_status": inc.webhook_status,
                    "created_at": inc.created_at.isoformat(),
                }
                for inc in recent_sn_incidents
            ],
        }
