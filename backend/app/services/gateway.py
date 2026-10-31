"""Simulation gateway and Policy Enforcement Point (PEP) (BLUEPRINT §6.5, §6.6, §8, §15.2 B8)."""
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.db.models import Grant, User, Resource, Notification
from app.ids import generate_id
from app.domain.pdp import (
    evaluate_access,
    SubjectContext,
    GrantContext,
    InvocationContext,
    Decision,
)
from app.domain.errors import DomainError
from app.services.audit import AuditService
from app.sim.mock_resources import execute_mock_resource_action


class SimulationGateway:
    @staticmethod
    def invoke(
        db: Session,
        resource_id: str,
        action: str,
        declared_purpose: str | None,
        caller_sub: str,
        input_data: Any = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        # 1. Purpose is required
        if not declared_purpose:
            raise DomainError("Declared purpose is mandatory for invoking protected resources", code="VALIDATION_FAILED", status_code=422)

        # 2. Check subject in DB
        user = db.get(User, caller_sub)
        is_active = bool(user.active) if user else False
        subject_ctx = SubjectContext(sub=caller_sub, is_active=is_active)

        # 3. Find caller's grant on this resource
        # Do NOT leak existence of other users' grants (EC-P03)
        grant_row = db.execute(
            select(Grant).where(
                and_(
                    Grant.requester_sub == caller_sub,
                    Grant.resource_id == resource_id,
                )
            ).order_by(Grant.activated_at.desc())
        ).scalars().first()

        grant_ctx: GrantContext | None = None
        if grant_row:
            act_at = grant_row.activated_at
            if act_at.tzinfo is None:
                act_at = act_at.replace(tzinfo=timezone.utc)
            exp_at = grant_row.expires_at
            if exp_at.tzinfo is None:
                exp_at = exp_at.replace(tzinfo=timezone.utc)
            rev_at = grant_row.revoked_at
            if rev_at is not None and rev_at.tzinfo is None:
                rev_at = rev_at.replace(tzinfo=timezone.utc)
            susp_at = grant_row.suspended_at
            if susp_at is not None and susp_at.tzinfo is None:
                susp_at = susp_at.replace(tzinfo=timezone.utc)

            grant_ctx = GrantContext(
                id=grant_row.id,
                requester_sub=grant_row.requester_sub,
                resource_id=grant_row.resource_id,
                purpose_code=grant_row.purpose_code,
                actions=frozenset(grant_row.actions),
                activated_at=act_at,
                expires_at=exp_at,
                revoked_at=rev_at,
                suspended_at=susp_at,
            )

        inv_ctx = InvocationContext(
            resource_id=resource_id,
            action=action,
            declared_purpose=declared_purpose,
        )

        # 4. Pure PDP evaluation in strict order (§6.6)
        decision = evaluate_access(subject_ctx, grant_ctx, inv_ctx, current_time)

        # 5. Record audit event inside transaction
        event_type = "ACCESS_ALLOWED" if decision.allow else "ACCESS_DENIED"
        is_violation = decision.code in ["DENY_PURPOSE_MISMATCH", "DENY_ACTION_NOT_GRANTED"]

        audit_payload = {
            "resource_id": resource_id,
            "action": action,
            "declared_purpose": declared_purpose,
            "grant_id": grant_ctx.id if grant_ctx else None,
            "decision_code": decision.code,
        }
        if is_violation:
            audit_payload["violation"] = True

        AuditService.append_event(
            session=db,
            event_type=event_type,
            subject_type="grant" if grant_ctx else "resource",
            subject_id=grant_ctx.id if grant_ctx else resource_id,
            payload=audit_payload,
            actor_sub=caller_sub,
            now=current_time,
        )

        output = None
        if decision.allow:
            # Innovation 5: Update utilization on grant
            if grant_row:
                grant_row.last_used_at = current_time
                grant_row.invocation_count = (grant_row.invocation_count or 0) + 1
                db.flush()
            output = execute_mock_resource_action(resource_id, action)
        elif is_violation:
            # Innovation 4: Purpose-Bound Violation Detection & Security Notification
            resource = db.get(Resource, resource_id)
            if resource and resource.owner_sub:
                db.add(Notification(
                    id=generate_id("notif"),
                    to_sub=resource.owner_sub,
                    kind="POLICY_VIOLATION_ATTEMPT",
                    ref_id=grant_ctx.id if grant_ctx else resource_id,
                    message=f"Access violation: User '{caller_sub}' attempted '{action}' on '{resource_id}' with purpose '{declared_purpose}' ({decision.code}).",
                    created_at=current_time,
                ))
                db.flush()

        return {
            "decision": {
                "allow": decision.allow,
                "code": decision.code,
                "violation": is_violation,
                "trace": [
                    {"check_name": t.check_name, "status": t.status, "detail": t.detail}
                    for t in decision.trace
                ],
            },
            "output": output,
        }
