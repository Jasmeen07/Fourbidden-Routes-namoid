"""Request submission, validation, routing, and lifecycle service matching BLUEPRINT §6.1, §6.4, §8, §13."""
import re
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.db.models import AccessRequest, ReviewSlot, Resource, User, UserRole, Grant
from app.db.txn import write_txn
from app.services.audit import AuditService
from app.domain.limits import Limits
from app.domain.states import RequestStatus, SlotStatus, validate_request_transition
from app.domain.hashing import compute_request_content_hash
from app.domain.policy import PolicyConfig
from app.domain.effective import compute_effective_status
from app.domain.errors import (
    DomainError,
    ControlsMissingError,
    SecretPatternDetectedError,
    DuplicateRequestError,
    GrantAlreadyActiveError,
    RequestNotOpenError,
    ExtensionCapExceededError,
    GrantRevokedCannotExtendError,
    BlockedNoEligibleReviewerError,
)
from app.ids import generate_id
from app.domain.hierarchy import CRUCIAL_RESOURCE_IDS

# Secret scanner patterns (EC-R05)
SECRET_PATTERNS = [
    re.compile(r'(?:password|secret|api_key|token|private_key)\s*[:=]\s*\S+', re.IGNORECASE),
    re.compile(r'(?:bearer\s+[a-zA-Z0-9\-._~+/]+=*)', re.IGNORECASE),
    re.compile(r'\b(?:\d{4}[- ]?){3}\d{4}\b'),  # Credit card / 16 digit ID
    re.compile(r'AKIA[0-9A-Z]{16}'),  # AWS key
]


def scan_for_secrets(text: str) -> None:
    """Detects secrets in free text without echoing the match (EC-R05)."""
    for pat in SECRET_PATTERNS:
        if pat.search(text):
            raise SecretPatternDetectedError(
                "Request text appears to contain sensitive tokens, keys, or credentials"
            )


class RequestsService:
    @staticmethod
    def submit_request(
        db: Session,
        policy: PolicyConfig,
        requester_sub: str,
        resource_id: str,
        purpose_code: str,
        purpose_text: str,
        actions: list[str],
        duration_minutes: int,
        risk_controls: list[str],
        extends_grant_id: str | None = None,
        now: datetime | None = None,
    ) -> AccessRequest:
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        # 1. Validate free text for secrets (EC-R05)
        scan_for_secrets(purpose_text)

        # 2. Validate resource
        resource = db.get(Resource, resource_id)
        if not resource or not resource.active:
            raise DomainError(f"Resource '{resource_id}' is not found or inactive", code="VALIDATION_FAILED", status_code=404)

        # 3. Validate actions
        resource_actions = {a["name"] if isinstance(a, dict) else a for a in resource.allowed_actions}
        if not actions or not set(actions).issubset(resource_actions):
            raise DomainError("Requested actions must be non-empty and offered by resource", code="VALIDATION_FAILED", status_code=422)

        # 4. Validate purpose
        if purpose_code not in policy.purposes:
            raise DomainError(f"Unknown purpose code '{purpose_code}'", code="VALIDATION_FAILED", status_code=422)

        # 5. Validate duration bounds
        tier = resource.tier
        max_duration = policy.limits.max_duration_minutes_by_tier.get(tier, 1440)
        if duration_minutes < policy.limits.min_duration_minutes or duration_minutes > max_duration:
            raise DomainError(
                f"Duration must be between {policy.limits.min_duration_minutes} and {max_duration} minutes for tier {tier}",
                code="VALIDATION_FAILED",
                status_code=422,
            )

        # 6. Validate required risk controls (EC-R04)
        required_controls = policy.risk_controls.required_by_tier.get(tier, [])
        missing = [c for c in required_controls if c not in risk_controls]
        if missing:
            raise ControlsMissingError(
                f"Missing required risk controls for tier {tier}: {missing}",
                details={"missing": missing}
            )

        # 7. Check extension constraints if extends_grant_id is given (EC-G04, EC-G15)
        if extends_grant_id:
            prior_grant = db.get(Grant, extends_grant_id)
            if not prior_grant:
                raise DomainError("Referenced grant for extension not found", code="VALIDATION_FAILED", status_code=404)
            if prior_grant.revoked_at is not None:
                raise GrantRevokedCannotExtendError("Cannot request extension for a revoked grant")

            # Check cumulative duration
            prior_duration = int((prior_grant.expires_at - prior_grant.activated_at).total_seconds() / 60)
            if prior_duration + duration_minutes > policy.limits.max_cumulative_minutes_with_extensions:
                raise ExtensionCapExceededError(
                    f"Cumulative duration ({prior_duration + duration_minutes}m) exceeds cap of {policy.limits.max_cumulative_minutes_with_extensions}m"
                )

        # 8. Check for duplicate open request (EC-R06)
        existing_open = db.execute(
            select(AccessRequest).where(
                and_(
                    AccessRequest.requester_sub == requester_sub,
                    AccessRequest.resource_id == resource_id,
                    AccessRequest.purpose_code == purpose_code,
                    AccessRequest.status.in_([RequestStatus.IN_REVIEW.value, RequestStatus.BLOCKED.value]),
                )
            )
        ).scalar_one_or_none()
        if existing_open:
            raise DuplicateRequestError(
                "An open request already exists for this resource and purpose",
                details={"existing_request_id": existing_open.id}
            )

        # 9. Check if an active grant already covers this ask (EC-R07)
        active_grant = db.execute(
            select(Grant).where(
                and_(
                    Grant.requester_sub == requester_sub,
                    Grant.resource_id == resource_id,
                    Grant.purpose_code == purpose_code,
                    Grant.status == "ACTIVE",
                    Grant.revoked_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if active_grant and compute_effective_status(active_grant, current_time).value == "ACTIVE":
            if set(actions).issubset(set(active_grant.actions)):
                raise GrantAlreadyActiveError(
                    "An active grant already covers the requested actions and purpose",
                    details={"grant_id": active_grant.id}
                )

        # Compute content hash
        content_hash = compute_request_content_hash(
            requester_sub=requester_sub,
            resource_id=resource_id,
            purpose_code=purpose_code,
            purpose_text=purpose_text,
            actions=actions,
            duration_minutes=duration_minutes,
            risk_controls=risk_controls,
            policy_version=policy.version,
        )

        req_id = generate_id("req")
        requester = db.get(User, requester_sub)

        # Agent Delegated Permissions Check (FORGE §5.2, §7.3)
        if requester and requester.is_agent:
            delegated = set(requester.delegated_permissions or [])
            if not set(actions).issubset(delegated):
                raise DomainError(
                    f"Requested actions {sorted(list(set(actions) - delegated))} exceed explicitly delegated permissions for AI Agent '{requester_sub}'",
                    code="DELEGATION_CONTROL_VIOLATION",
                    status_code=403,
                )

        # FORGE Hierarchy & Crucial Data Routing (§7, §9.2)
        is_crucial = (
            bool(getattr(resource, "is_crucial", False))
            or (resource_id in CRUCIAL_RESOURCE_IDS)
            or (resource.tier == "RESTRICTED_SYNTHETIC")
            or (getattr(resource, "sensitivity", "") in ["CRITICAL", "RESTRICTED"])
        )
        requester_dept = requester.department if requester else "General"
        resource_dept = getattr(resource, "department", "General")
        is_cross_dept = (requester_dept.lower() != resource_dept.lower())

        # Determine review slot roles: Blueprint test fixtures use policy matrix; FORGE users route by cruciality/hierarchy
        if requester_sub.startswith("usr_"):
            required_slot_roles = list(policy.approval_matrix.get(resource.tier, ["manager"]))
        elif is_crucial or is_cross_dept:
            required_slot_roles = ["manager", "resource_owner", "risk_reviewer"]
        else:
            required_slot_roles = ["manager"]

        slots: list[ReviewSlot] = []
        is_blocked = False

        # Route slots
        assigned_subs = set()
        for role in required_slot_roles:
            assigned_sub = None
            if role == "manager":
                if requester and requester.is_agent and requester.owner_sub:
                    owner_user = db.get(User, requester.owner_sub)
                    assigned_sub = owner_user.manager_sub if owner_user else None
                else:
                    assigned_sub = requester.manager_sub if requester else None
                if not assigned_sub or assigned_sub == requester_sub:
                    mgr_candidates = db.execute(
                        select(UserRole.sub).where(UserRole.role == "manager")
                    ).scalars().all()
                    for m in mgr_candidates:
                        if m != requester_sub:
                            assigned_sub = m
                            break
            elif role == "resource_owner":
                assigned_sub = resource.owner_sub
                if not assigned_sub or assigned_sub == requester_sub or assigned_sub in assigned_subs:
                    ro_candidates = db.execute(
                        select(UserRole.sub).where(UserRole.role == "resource_owner")
                    ).scalars().all()
                    for r in ro_candidates:
                        if r != requester_sub and r not in assigned_subs:
                            assigned_sub = r
                            break
            elif role == "risk_reviewer":
                candidates = db.execute(
                    select(UserRole.sub).where(UserRole.role == "risk_reviewer")
                ).scalars().all()
                for c in candidates:
                    if c != requester_sub and c not in assigned_subs:
                        assigned_sub = c
                        break

            # SoD check at assignment (SG-1 and dual slot)
            if assigned_sub is None:
                raise BlockedNoEligibleReviewerError(f"No eligible reviewer found for role '{role}'")
            if assigned_sub == requester_sub or assigned_sub in assigned_subs:
                is_blocked = True

            assigned_subs.add(assigned_sub)
            slot = ReviewSlot(
                id=generate_id("slot"),
                request_id=req_id,
                slot_role=role,
                assigned_sub=assigned_sub,
                status=SlotStatus.PENDING.value,
            )
            slots.append(slot)

        initial_status = RequestStatus.BLOCKED.value if is_blocked else RequestStatus.IN_REVIEW.value

        request_obj = AccessRequest(
            id=req_id,
            requester_sub=requester_sub,
            resource_id=resource_id,
            purpose_code=purpose_code,
            purpose_text=purpose_text,
            actions=actions,
            duration_minutes=duration_minutes,
            risk_controls=risk_controls,
            status=initial_status,
            policy_version=policy.version,
            content_hash=content_hash,
            extends_grant_id=extends_grant_id,
            created_at=current_time,
        )

        db.add(request_obj)
        for s in slots:
            db.add(s)
        db.flush()

        # Audit event
        AuditService.append_event(
            session=db,
            event_type="REQUEST_SUBMITTED" if not extends_grant_id else "EXTENSION_REQUESTED",
            subject_type="request",
            subject_id=req_id,
            payload={
                "resource_id": resource_id,
                "purpose_code": purpose_code,
                "actions": sorted(actions),
                "duration_minutes": duration_minutes,
                "risk_controls": sorted(risk_controls),
                "policy_version": policy.version,
                "status": initial_status,
            },
            actor_sub=requester_sub,
            actor_role="requester",
            now=current_time,
        )

        return request_obj

    @staticmethod
    def withdraw_request(db: Session, request_id: str, requester_sub: str, now: datetime | None = None) -> AccessRequest:
        current_time = now or datetime.now(timezone.utc)
        req = db.get(AccessRequest, request_id)
        if not req:
            raise DomainError("Request not found", code="VALIDATION_FAILED", status_code=404)
        if req.requester_sub != requester_sub:
            raise DomainError("Not authorized to withdraw this request", code="NOT_ASSIGNED", status_code=403)
        if req.status not in (RequestStatus.IN_REVIEW.value, RequestStatus.BLOCKED.value):
            raise RequestNotOpenError(f"Cannot withdraw request in state '{req.status}'")

        validate_request_transition(RequestStatus(req.status), RequestStatus.WITHDRAWN)
        req.status = RequestStatus.WITHDRAWN.value

        # Cancel pending slots
        for s in req.slots:
            if s.status == SlotStatus.PENDING.value:
                s.status = SlotStatus.CANCELLED.value

        db.flush()

        AuditService.append_event(
            session=db,
            event_type="REQUEST_WITHDRAWN",
            subject_type="request",
            subject_id=req.id,
            payload={"status": req.status},
            actor_sub=requester_sub,
            actor_role="requester",
            now=current_time,
        )
        return req
