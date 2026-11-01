"""Grants management, revocation, sweeper, and tamper detection (BLUEPRINT §6.2, §6.7, §8, §10.4)."""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.db.models import Grant, AccessRequest, Resource, User, UserRole, Notification
from app.services.audit import AuditService
from app.domain.effective import compute_effective_status
from app.domain.states import GrantStatus, RequestStatus
from app.domain.policy import PolicyConfig
from app.domain.errors import (
    DomainError,
    NotAuthorizedToRevokeError,
)
from app.ids import generate_id


class GrantsService:
    @staticmethod
    def get_grant_with_effective_status(grant: Grant, now: datetime) -> dict:
        eff_status = compute_effective_status(grant, now)

        # Innovation 5: Smart Access Utilization
        inv_count = getattr(grant, "invocation_count", 0) or 0
        last_used = getattr(grant, "last_used_at", None)

        if eff_status.value != "ACTIVE":
            util_status = eff_status.value
        elif inv_count == 0:
            util_status = "NEVER_USED"
        elif last_used:
            lu_dt = last_used if last_used.tzinfo else last_used.replace(tzinfo=timezone.utc)
            now_dt = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
            hours_since_use = (now_dt - lu_dt).total_seconds() / 3600.0
            if hours_since_use > 24:
                util_status = "REVIEW_SUGGESTED"
            else:
                util_status = "ACTIVE_UTILIZING"
        else:
            util_status = "ACTIVE_UTILIZING"

        return {
            "id": grant.id,
            "request_id": grant.request_id,
            "requester_sub": grant.requester_sub,
            "resource_id": grant.resource_id,
            "purpose_code": grant.purpose_code,
            "actions": grant.actions,
            "activated_at": grant.activated_at.isoformat(),
            "expires_at": grant.expires_at.isoformat(),
            "status": eff_status.value,
            "effective_status": eff_status.value,
            "stored_status": grant.status,
            "revoked_at": grant.revoked_at.isoformat() if grant.revoked_at else None,
            "revoked_by_sub": grant.revoked_by_sub,
            "revoke_reason_code": grant.revoke_reason_code,
            "revoke_emergency": grant.revoke_emergency,
            "last_used_at": last_used.isoformat() if last_used else None,
            "invocation_count": inv_count,
            "utilization_status": util_status,
        }

    @staticmethod
    def revoke_grant(
        db: Session,
        policy: PolicyConfig,
        grant_id: str,
        revoker_sub: str,
        reason_code: str,
        emergency: bool = False,
        note: str | None = None,
        now: datetime | None = None,
    ) -> Grant:
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        grant = db.get(Grant, grant_id)
        if not grant:
            raise DomainError("Grant not found", code="VALIDATION_FAILED", status_code=404)

        # Idempotency check: revoking twice is an idempotent success (EC-G09)
        if grant.revoked_at is not None:
            return grant

        # Check reason code
        if reason_code not in policy.revocation.reason_codes:
            raise DomainError(f"Invalid revocation reason code '{reason_code}'", code="VALIDATION_FAILED", status_code=422)

        # Authorization check: allowed_revokers (EC-G10)
        # allowed: resource_owner, risk_reviewer, manager_of_requester, requester_self
        resource = db.get(Resource, grant.resource_id)
        requester = db.get(User, grant.requester_sub)
        revoker_roles = set(
            db.execute(select(UserRole.role).where(UserRole.sub == revoker_sub)).scalars().all()
        )

        is_owner = (resource is not None and resource.owner_sub == revoker_sub)
        is_risk = "risk_reviewer" in revoker_roles
        is_manager = (requester is not None and requester.manager_sub == revoker_sub)
        is_self = (grant.requester_sub == revoker_sub)

        if not (is_owner or is_risk or is_manager or is_self):
            raise NotAuthorizedToRevokeError(
                f"User {revoker_sub} is not authorized to revoke this grant",
                details={"grant_id": grant_id, "revoker_sub": revoker_sub}
            )

        # Set revocation state
        grant.revoked_at = current_time
        grant.revoked_by_sub = revoker_sub
        grant.revoke_reason_code = reason_code
        grant.revoke_emergency = emergency
        grant.status = GrantStatus.REVOKED.value
        db.flush()

        # Audit event with emergency flag (EC-G16)
        AuditService.append_event(
            session=db,
            event_type="GRANT_REVOKED",
            subject_type="grant",
            subject_id=grant.id,
            payload={
                "resource_id": grant.resource_id,
                "reason_code": reason_code,
                "emergency": emergency,
                "note": note,
                "revoked_at": current_time.isoformat(),
            },
            actor_sub=revoker_sub,
            actor_role="risk_reviewer" if is_risk else ("resource_owner" if is_owner else "requester"),
            now=current_time,
        )

        # Create in-app notifications
        notify_subs = {grant.requester_sub}
        if resource:
            notify_subs.add(resource.owner_sub)
        if requester and requester.manager_sub:
            notify_subs.add(requester.manager_sub)

        for to_sub in notify_subs:
            notif = Notification(
                id=generate_id("notif"),
                to_sub=to_sub,
                kind="GRANT_REVOKED",
                ref_id=grant.id,
                message=f"{'EMERGENCY ' if emergency else ''}Grant {grant.id} on {grant.resource_id} was revoked: {reason_code}",
                created_at=current_time,
            )
            db.add(notif)

        db.flush()
        return grant

    @staticmethod
    def tick_sweeper(db: Session, policy: PolicyConfig, now: datetime) -> int:
        """
        Background status tidy only (NFR-1, EC-G06, EC-G07, EC-R10):
        1. Sweeps ACTIVE grants where now >= expires_at -> marks EXPIRED and emits one GRANT_EXPIRED audit event.
        2. Sweeps IN_REVIEW requests whose TTL has elapsed -> marks EXPIRED_UNREVIEWED.
        """
        # 1. Expire grants
        active_grants = db.execute(
            select(Grant).where(
                and_(
                    Grant.status == "ACTIVE",
                    Grant.expires_at <= now,
                    Grant.revoked_at.is_(None),
                )
            )
        ).scalars().all()

        expired_count = 0
        for g in active_grants:
            g.status = GrantStatus.EXPIRED.value
            db.flush()
            AuditService.append_event(
                session=db,
                event_type="GRANT_EXPIRED",
                subject_type="grant",
                subject_id=g.id,
                payload={
                    "resource_id": g.resource_id,
                    "expired_at": g.expires_at.isoformat(),
                },
                now=now,
            )
            expired_count += 1

        # 2. Expire stale requests (TTL)
        from datetime import timedelta
        ttl_delta = timedelta(hours=policy.limits.request_pending_ttl_hours)
        stale_requests = db.execute(
            select(AccessRequest).where(
                and_(
                    AccessRequest.status.in_([RequestStatus.IN_REVIEW.value, RequestStatus.BLOCKED.value]),
                    AccessRequest.created_at <= (now - ttl_delta),
                )
            )
        ).scalars().all()

        for r in stale_requests:
            r.status = RequestStatus.EXPIRED_UNREVIEWED.value
            for s in r.slots:
                if s.status == "PENDING":
                    s.status = "CANCELLED"
            db.flush()
            AuditService.append_event(
                session=db,
                event_type="REQUEST_EXPIRED_UNREVIEWED",
                subject_type="request",
                subject_id=r.id,
                payload={"created_at": r.created_at.isoformat()},
                now=now,
            )

        return expired_count
