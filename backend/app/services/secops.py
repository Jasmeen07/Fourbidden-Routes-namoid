"""SecOps Service: Detection, Incident Management, IP Restriction, and Threat Intelligence.

Inspired by ServiceNow Security Operations (SecOps).
Adheres strictly to AGENTS.md rules:
- Audit events written in the same transaction (Rule 5).
- Never store secrets/passwords/tokens (Rule 6).
- Time via injected clock (Rule 4).
"""
from datetime import datetime, timezone, timedelta
import ipaddress
import json
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.db.models import SecurityEvent, SecurityIncident, IpReputation, ThreatIntelIndicator
from app.domain.secops import (
    scan_input,
    calculate_risk_score,
    evaluate_ip_action,
    sanitize_content,
    mask_sensitive_data,
)
from app.ids import generate_id
from app.services.audit import AuditService

TRUSTED_PROXIES = {
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
}


def resolve_client_ip(client_host: str | None, x_forwarded_for: str | None) -> str:
    """Safely extracts client IP respecting trusted proxy boundaries."""
    raw_ip = client_host or "127.0.0.1"
    if x_forwarded_for:
        # X-Forwarded-For is client, proxy1, proxy2...
        parts = [p.strip() for p in x_forwarded_for.split(",") if p.strip()]
        if parts:
            try:
                candidate = parts[0]
                ipaddress.ip_address(candidate)
                # If immediate host is a trusted private proxy, trust the forwarded client
                host_addr = ipaddress.ip_address(raw_ip)
                if any(host_addr in net for net in TRUSTED_PROXIES):
                    return candidate
            except ValueError:
                pass
    return raw_ip


class SecOpsService:
    @staticmethod
    def inspect_and_record(
        db: Session,
        ip: str,
        method: str,
        path: str,
        payload_data: Any,
        user_sub: str | None,
        now: datetime,
    ) -> dict[str, Any]:
        """Inspects request for attacks, checks IP reputation & threat intel, records events,

        and automatically triggers incident management if high/critical.
        """
        # 1. Check IP Reputation in DB
        rep = db.get(IpReputation, ip)
        is_allowlisted = False
        is_already_blocked = False
        repeat_count = 0

        if rep:
            repeat_count = rep.malicious_attempts
            if rep.status == "ALLOWLISTED":
                is_allowlisted = True
            elif rep.status in ("TEMP_BLOCKED", "PERM_BLOCKED"):
                bu = rep.blocked_until
                if bu and bu.tzinfo is None:
                    bu = bu.replace(tzinfo=timezone.utc)

                if bu and bu > now:
                    is_already_blocked = True
                elif rep.status == "PERM_BLOCKED":
                    is_already_blocked = True
                else:
                    # Expired temporary block
                    rep.status = "FLAGGED"
                    rep.blocked_until = None
                    rep.block_reason = "Temporary block expired"

        # 2. Check Threat Intelligence Feeds for IP match
        ti_match = db.execute(
            select(ThreatIntelIndicator).where(
                ThreatIntelIndicator.value == ip,
                ThreatIntelIndicator.is_active == True,
            )
        ).scalar_one_or_none()
        is_threat_intel = ti_match is not None

        # 3. Flatten payload / text for pattern inspection
        combined_text = f"{path} "
        if payload_data is not None:
            if isinstance(payload_data, (dict, list)):
                try:
                    combined_text += json.dumps(payload_data)
                except Exception:
                    combined_text += str(payload_data)
            else:
                combined_text += str(payload_data)

        # 4. Pure Domain Threat Scanning
        threats = scan_input(combined_text)

        # Also check if payload contains any threat intel URLs, domains or hashes
        if not is_threat_intel:
            active_tis = db.execute(
                select(ThreatIntelIndicator).where(ThreatIntelIndicator.is_active == True)
            ).scalars().all()
            for ti in active_tis:
                if ti.value in combined_text:
                    is_threat_intel = True
                    ti_match = ti
                    break

        # 5. Calculate Risk Score & Severity
        risk_score, severity = calculate_risk_score(
            threats=threats,
            repeat_attempts=repeat_count,
            is_threat_intel_match=is_threat_intel,
        )

        # 6. Evaluate Mitigation Action
        action, reason, block_duration = evaluate_ip_action(
            ip=ip,
            risk_score=risk_score,
            repeat_count=repeat_count,
            is_allowlisted=is_allowlisted,
            is_threat_intel=is_threat_intel,
            is_already_blocked=is_already_blocked,
        )

        # 7. Update IP Reputation
        if not is_allowlisted:
            if not rep:
                rep = IpReputation(
                    ip=ip,
                    status="CLEAN",
                    risk_score=risk_score,
                    malicious_attempts=0,
                    last_seen_at=now,
                    manual_override=False,
                )
                db.add(rep)

            rep.last_seen_at = now
            rep.risk_score = max(rep.risk_score, risk_score)
            if threats or is_threat_intel:
                rep.malicious_attempts += 1

            if action == "BLOCKED" and rep.status != "PERM_BLOCKED":
                rep.status = "TEMP_BLOCKED"
                rep.blocked_until = now + timedelta(seconds=block_duration)
                rep.block_reason = reason
            elif action == "RATE_LIMITED" and rep.status not in ("TEMP_BLOCKED", "PERM_BLOCKED"):
                rep.status = "RATE_LIMITED"
                rep.block_reason = reason
            elif action == "FLAGGED" and rep.status == "CLEAN":
                rep.status = "FLAGGED"
                rep.block_reason = reason

        # 8. Automatic Incident Creation for CRITICAL or HIGH threats
        incident_id = None
        if (severity in ("CRITICAL", "HIGH") or action == "BLOCKED") and not is_allowlisted:
            incident_id = SecOpsService._create_automatic_incident(
                db=db,
                ip=ip,
                user_sub=user_sub,
                severity=severity,
                risk_score=risk_score,
                threats=threats,
                ti_match=ti_match,
                now=now,
            )

        # 9. Create Immutable Security Event Record
        event_id = generate_id("sec_evt")
        primary_threat = threats[0] if threats else None
        category = primary_threat.category if primary_threat else ("THREAT_INTEL" if is_threat_intel else "CLEAN")
        pattern_name = primary_threat.rule_name if primary_threat else (f"TI_MATCH_{ti_match.type}" if ti_match else None)

        sec_event = SecurityEvent(
            id=event_id,
            timestamp=now,
            source_ip=ip,
            user_sub=user_sub,
            method=method,
            path=path,
            category=category,
            pattern_matched=pattern_name,
            risk_score=risk_score,
            severity=severity,
            action_taken=action,
            repeat_count=repeat_count + (1 if (threats or is_threat_intel) else 0),
            incident_id=incident_id,
            payload_snippet=mask_sensitive_data(combined_text),
            status="LOGGED" if action != "BLOCKED" else "BLOCKED_BY_WAF",
        )
        db.add(sec_event)

        # 10. Write Audit Event in SAME transaction (Rule 5)
        if threats or is_threat_intel or action == "BLOCKED":
            AuditService.append_event(
                session=db,
                event_type="WAF_ATTACK_DETECTED" if action != "BLOCKED" else "WAF_REQUEST_BLOCKED",
                subject_type="ip",
                subject_id=ip,
                actor_sub=user_sub or "unauthenticated",
                payload={
                    "event_id": event_id,
                    "source_ip": ip,
                    "category": category,
                    "action_taken": action,
                    "risk_score": risk_score,
                    "severity": severity,
                    "incident_id": incident_id,
                },
                now=now,
            )

        return {
            "allowed": action != "BLOCKED",
            "action": action,
            "reason": reason,
            "risk_score": risk_score,
            "severity": severity,
            "event_id": event_id,
            "incident_id": incident_id,
            "threats_detected": [
                {
                    "category": t.category,
                    "rule": t.rule_name,
                    "matched": t.matched_snippet,
                    "severity_score": t.base_severity_score,
                }
                for t in threats
            ],
            "threat_intel_match": {
                "type": ti_match.type,
                "actor": ti_match.threat_actor,
                "campaign": ti_match.campaign,
                "confidence": ti_match.confidence,
            } if ti_match else None,
        }

    @staticmethod
    def _create_automatic_incident(
        db: Session,
        ip: str,
        user_sub: str | None,
        severity: str,
        risk_score: int,
        threats: Sequence[Any],
        ti_match: Any | None,
        now: datetime,
    ) -> str:
        """ServiceNow SIR: Automatically create a security incident for high-risk attacks."""
        inc_count = db.execute(select(func.count(SecurityIncident.id))).scalar() or 0
        incident_id = f"INC-2026-{10001 + inc_count}"

        p_threat = threats[0].category if threats else ("THREAT_INTEL" if ti_match else "SUSPICIOUS_ACCESS")
        title = f"WAF Defense Alert: {p_threat} detected from {ip}"
        if ti_match:
            title += f" [Campaign: {ti_match.campaign or 'Unknown'}]"

        priority = "P1" if severity == "CRITICAL" else "P2"
        description = (
            f"Automated SecOps incident generated at {now.isoformat()}.\n"
            f"Source IP: {ip}\n"
            f"Risk Score: {risk_score}/100 ({severity})\n"
            f"User Context: {user_sub or 'Unauthenticated'}\n"
            f"Threat Categories: {', '.join(set(t.category for t in threats)) if threats else 'Threat Intelligence'}\n"
        )
        if ti_match:
            description += f"Threat Intel Actor: {ti_match.threat_actor} (Confidence: {ti_match.confidence}%)\n"

        initial_note = {
            "author": "System WAF / SecOps Engine",
            "timestamp": now.isoformat(),
            "text": f"Incident auto-triaged to {priority}. Immediate IP rate-limiting and temporary restriction initiated.",
        }

        incident = SecurityIncident(
            id=incident_id,
            title=title,
            description=description,
            severity=severity,
            priority=priority,
            status="NEW",
            source_ip=ip,
            user_sub=user_sub,
            assigned_to="R001",  # Security Officer Rachel Ramos
            created_at=now,
            updated_at=now,
            resolved_at=None,
            resolution_notes=None,
            investigation_notes=[initial_note],
        )
        db.add(incident)

        AuditService.append_event(
            session=db,
            event_type="SECURITY_INCIDENT_CREATED",
            subject_type="incident",
            subject_id=incident_id,
            actor_sub=user_sub or "system",
            payload={
                "incident_id": incident_id,
                "title": title,
                "severity": severity,
                "priority": priority,
                "source_ip": ip,
            },
            now=now,
        )

        return incident_id

    @staticmethod
    def update_incident_status(
        db: Session,
        incident_id: str,
        status: str,
        actor_sub: str,
        assigned_to: str | None,
        note: str | None,
        resolution_notes: str | None,
        now: datetime,
    ) -> SecurityIncident:
        """ServiceNow SIR: Updates incident lifecycle status and appends investigation notes."""
        incident = db.get(SecurityIncident, incident_id)
        if not incident:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found")

        valid_statuses = {"NEW", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"}
        if status not in valid_statuses:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail=f"Invalid status: {status}. Must be one of {valid_statuses}")

        old_status = incident.status
        incident.status = status
        incident.updated_at = now
        if assigned_to:
            incident.assigned_to = assigned_to

        notes_list = list(incident.investigation_notes or [])
        if note:
            notes_list.append({
                "author": actor_sub,
                "timestamp": now.isoformat(),
                "text": note,
            })
        if status != old_status:
            notes_list.append({
                "author": actor_sub,
                "timestamp": now.isoformat(),
                "text": f"Status updated from {old_status} to {status}",
            })
        incident.investigation_notes = notes_list

        if status in ("RESOLVED", "CLOSED"):
            incident.resolved_at = now
            if resolution_notes:
                incident.resolution_notes = resolution_notes

        AuditService.append_event(
            session=db,
            event_type="SECURITY_INCIDENT_UPDATED",
            subject_type="incident",
            subject_id=incident_id,
            actor_sub=actor_sub,
            payload={
                "incident_id": incident_id,
                "old_status": old_status,
                "new_status": status,
                "assigned_to": incident.assigned_to,
            },
            now=now,
        )
        return incident

    @staticmethod
    def contain_incident(
        db: Session,
        incident_id: str,
        containment_action: str,
        actor_sub: str,
        now: datetime,
    ) -> dict[str, Any]:
        """ServiceNow SOAR: Execute automated containment action (e.g. isolate IP)."""
        incident = db.get(SecurityIncident, incident_id)
        if not incident:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Incident not found")

        result = {}
        if containment_action == "isolate_ip" and incident.source_ip:
            rep = db.get(IpReputation, incident.source_ip)
            if not rep:
                rep = IpReputation(
                    ip=incident.source_ip,
                    status="PERM_BLOCKED",
                    risk_score=100,
                    malicious_attempts=5,
                    last_seen_at=now,
                    blocked_until=now + timedelta(days=365),
                    block_reason=f"SOAR Containment for {incident_id}",
                    manual_override=True,
                )
                db.add(rep)
            else:
                rep.status = "PERM_BLOCKED"
                rep.blocked_until = now + timedelta(days=365)
                rep.block_reason = f"SOAR Containment for {incident_id}"
                rep.manual_override = True

            incident.status = "CONTAINED"
            incident.updated_at = now
            notes = list(incident.investigation_notes or [])
            notes.append({
                "author": actor_sub,
                "timestamp": now.isoformat(),
                "text": f"SOAR Action executed: IP {incident.source_ip} permanently isolated at WAF layer.",
            })
            incident.investigation_notes = notes
            result = {"action": "isolate_ip", "ip": incident.source_ip, "status": "PERM_BLOCKED"}

        AuditService.append_event(
            session=db,
            event_type="SECURITY_CONTAINMENT_EXECUTED",
            subject_type="incident",
            subject_id=incident_id,
            actor_sub=actor_sub,
            payload={
                "incident_id": incident_id,
                "action": containment_action,
                "source_ip": incident.source_ip,
            },
            now=now,
        )
        return result

    @staticmethod
    def set_ip_status(
        db: Session,
        ip: str,
        new_status: str,
        reason: str,
        actor_sub: str,
        duration_seconds: int | None,
        now: datetime,
    ) -> IpReputation:
        """Administratively block, unblock, or allowlist an IP address."""
        rep = db.get(IpReputation, ip)
        if not rep:
            rep = IpReputation(
                ip=ip,
                status=new_status,
                risk_score=0 if new_status in ("CLEAN", "ALLOWLISTED") else 85,
                malicious_attempts=0,
                last_seen_at=now,
                manual_override=True,
            )
            db.add(rep)

        rep.status = new_status
        rep.block_reason = reason
        rep.manual_override = True
        rep.last_seen_at = now

        if new_status in ("TEMP_BLOCKED", "PERM_BLOCKED"):
            if duration_seconds:
                rep.blocked_until = now + timedelta(seconds=duration_seconds)
            elif new_status == "PERM_BLOCKED":
                rep.blocked_until = now + timedelta(days=3650)
            else:
                rep.blocked_until = now + timedelta(hours=24)
        elif new_status in ("CLEAN", "ALLOWLISTED"):
            rep.blocked_until = None
            if new_status == "ALLOWLISTED":
                rep.risk_score = 0

        AuditService.append_event(
            session=db,
            event_type="IP_REPUTATION_UPDATED",
            subject_type="ip",
            subject_id=ip,
            actor_sub=actor_sub,
            payload={
                "ip": ip,
                "new_status": new_status,
                "reason": reason,
            },
            now=now,
        )
        return rep
