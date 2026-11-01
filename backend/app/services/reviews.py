"""Review decisions, limits narrowing, SoD enforcement, and grant activation (BLUEPRINT §6.2, §6.3, §6.11, §8, §10.4)."""
from datetime import datetime, timezone, timedelta
from typing import Literal
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.models import AccessRequest, ReviewSlot, Grant, User, UserRole, Resource, Notification
from app.services.audit import AuditService
from app.domain.limits import Limits, validate_narrowing, merge_limits
from app.domain.sod import check_sod_and_eligibility, Subject, RequestContext, SlotContext
from app.domain.states import RequestStatus, SlotStatus
from app.domain.errors import (
    DomainError,
    SodSelfReviewError,
    SodDualSlotError,
    NotAssignedError,
    RequestNotOpenError,
    StaleRequestError,
    DecisionConflictError,
    NarrowingConflictEmptyError,
)
from app.ids import generate_id


class ReviewsService:
    @staticmethod
    def record_decision(
        db: Session,
        request_id: str,
        slot_id: str,
        decision: Literal["approve", "narrow", "reject"],
        reviewer_sub: str,
        approved_limits: dict | None = None,
        rationale: str | None = None,
        expected_request_hash: str | None = None,
        now: datetime | None = None,
    ) -> tuple[AccessRequest, ReviewSlot, Grant | None]:
        current_time = now or datetime.now(timezone.utc)
        if current_time.tzinfo is None:
            current_time = current_time.replace(tzinfo=timezone.utc)

        # 1. Load request and slot
        request = db.get(AccessRequest, request_id)
        if not request:
            raise DomainError("Request not found", code="VALIDATION_FAILED", status_code=404)

        slot = db.get(ReviewSlot, slot_id)
        if not slot or slot.request_id != request_id:
            raise DomainError("Slot not found on this request", code="NOT_ASSIGNED", status_code=404)

        # 2. Check request is currently open (EC-V04)
        if request.status != RequestStatus.IN_REVIEW.value:
            raise RequestNotOpenError(f"Request is not open for decisions (status: {request.status})")

        # 3. Check expected_request_hash if provided (EC-V10)
        if expected_request_hash and expected_request_hash != request.content_hash:
            raise StaleRequestError("Request content hash does not match expected hash")

        # 4. Check reviewer subject and roles in DB dynamically (EC-V13)
        reviewer_user = db.get(User, reviewer_sub)
        if not reviewer_user or not reviewer_user.active:
            raise NotAssignedError("Reviewer user is inactive or not found")

        reviewer_roles = set(
            db.execute(select(UserRole.role).where(UserRole.sub == reviewer_sub)).scalars().all()
        )

        resource = db.get(Resource, request.resource_id)
        requester = db.get(User, request.requester_sub)

        # 5. Build context and execute pure Separation of Duties (SoD) check
        req_ctx = RequestContext(
            id=request.id,
            requester_sub=request.requester_sub,
            resource_id=request.resource_id,
            resource_owner_sub=resource.owner_sub if resource else "",
            requester_manager_sub=requester.manager_sub if requester else None,
        )
        cand_subject = Subject(sub=reviewer_sub, roles=frozenset(reviewer_roles))
        slot_ctx = SlotContext(id=slot.id, slot_role=slot.slot_role, assigned_sub=slot.assigned_sub)

        # Gather prior decisions on this request
        prior_decisions = [
            {"slot_role": s.slot_role, "decided_by_sub": s.decided_by_sub}
            for s in request.slots
            if s.decided_by_sub is not None
        ]

        try:
            check_sod_and_eligibility(req_ctx, cand_subject, slot_ctx, prior_decisions)
        except SodSelfReviewError as e:
            # Audit tamper attempt when requester tries to self-approve (SG-1, EC-V01)
            AuditService.append_event(
                session=db,
                event_type="SECURITY_TAMPER_ATTEMPT",
                subject_type="request",
                subject_id=request.id,
                payload={"attempt": "self_review", "slot_role": slot.slot_role, "error": e.code},
                actor_sub=reviewer_sub,
                actor_role="requester",
                now=current_time,
            )
            db.commit()
            raise

        # 6. Check slot idempotency vs conflict (EC-V05)
        decision_status_map = {
            "approve": SlotStatus.APPROVED.value,
            "narrow": SlotStatus.NARROWED.value,
            "reject": SlotStatus.REJECTED.value,
        }
        slot_status_value = decision_status_map.get(decision.lower(), SlotStatus.APPROVED.value)
        if slot.status != SlotStatus.PENDING.value:
            if slot.decision == slot_status_value:
                # Idempotent response
                return request, slot, request.grant
            raise DecisionConflictError(
                f"Slot has already been decided with '{slot.decision}' and cannot be changed to '{slot_status_value}'"
            )

        # 7. Validate decision parameters
        req_limits = Limits(
            resource_id=request.resource_id,
            purpose_code=request.purpose_code,
            actions=frozenset(request.actions),
            duration_minutes=request.duration_minutes,
        )

        computed_slot_limits = None
        if decision == "narrow":
            if not rationale or not rationale.strip():
                raise DomainError("Rationale is required when narrowing access limits", code="VALIDATION_FAILED", status_code=422)
            if not approved_limits:
                raise DomainError("approved_limits payload required for narrowing", code="VALIDATION_FAILED", status_code=422)

            computed_slot_limits = Limits(
                resource_id=request.resource_id,
                purpose_code=request.purpose_code,
                actions=frozenset(approved_limits.get("actions", [])),
                duration_minutes=int(approved_limits.get("duration_minutes", request.duration_minutes)),
            )
            # Enforce subset, non-noop, non-empty (SG-6, EC-V06..EC-V08)
            validate_narrowing(req_limits, computed_slot_limits)

        elif decision == "reject":
            if not rationale or not rationale.strip():
                raise DomainError("Rationale is required when rejecting a request", code="VALIDATION_FAILED", status_code=422)

        # 8. Record the decision on the slot
        decision_status_map = {
            "approve": SlotStatus.APPROVED.value,
            "narrow": SlotStatus.NARROWED.value,
            "reject": SlotStatus.REJECTED.value,
        }
        slot_status_value = decision_status_map.get(decision.lower(), SlotStatus.APPROVED.value)
        slot.status = slot_status_value
        slot.decision = slot_status_value
        slot.rationale = rationale
        slot.decided_by_sub = reviewer_sub
        slot.decided_role = slot.slot_role
        slot.decided_at = current_time
        slot.bound_request_hash = request.content_hash
        if computed_slot_limits:
            slot.approved_limits = {
                "actions": sorted(list(computed_slot_limits.actions)),
                "duration_minutes": computed_slot_limits.duration_minutes,
            }

        AuditService.append_event(
            session=db,
            event_type=f"DECISION_{slot_status_value}",
            subject_type="slot",
            subject_id=slot.id,
            payload={
                "request_id": request.id,
                "slot_role": slot.slot_role,
                "decision": slot_status_value,
                "rationale": rationale,
                "approved_limits": slot.approved_limits,
            },
            actor_sub=reviewer_sub,
            actor_role=slot.slot_role,
            now=current_time,
        )

        # 9. Handle Rejection Short-Circuit (EC-V11)
        if decision == "reject":
            request.status = RequestStatus.REJECTED.value
            for s in request.slots:
                if s.id != slot.id and s.status == SlotStatus.PENDING.value:
                    s.status = SlotStatus.CANCELLED.value

            db.flush()
            # Notify requester of rejection with who rejected and why
            res = db.get(Resource, request.resource_id)
            res_name = res.name if res else request.resource_id
            rev_user = db.get(User, reviewer_sub)
            rev_name = rev_user.display_name if rev_user else reviewer_sub
            rejection_notif = Notification(
                id=generate_id("notif"),
                to_sub=request.requester_sub,
                kind="REQUEST_REJECTED",
                ref_id=request.id,
                message=f"Access request {request.id[:10]} for {res_name} was REJECTED by {rev_name} ({slot.slot_role}). Rationale: '{rationale or 'Policy criteria not met'}'",
                created_at=current_time,
            )
            db.add(rejection_notif)

            AuditService.append_event(
                session=db,
                event_type="REQUEST_REJECTED",
                subject_type="request",
                subject_id=request.id,
                payload={"rejected_by_slot": slot.slot_role, "rationale": rationale},
                actor_sub=reviewer_sub,
                actor_role=slot.slot_role,
                now=current_time,
            )
            return request, slot, None

        # 10. Check if all required slots are now decided
        all_decided = all(s.status in (SlotStatus.APPROVED.value, SlotStatus.NARROWED.value) for s in request.slots)
        created_grant: Grant | None = None

        if all_decided:
            # Collect limits from all slots
            slot_limits_list: list[Limits] = []
            for s in request.slots:
                if s.status == SlotStatus.NARROWED.value and s.approved_limits:
                    slot_limits_list.append(
                        Limits(
                            resource_id=request.resource_id,
                            purpose_code=request.purpose_code,
                            actions=frozenset(s.approved_limits["actions"]),
                            duration_minutes=s.approved_limits["duration_minutes"],
                        )
                    )
                else:
                    # Approved slots contribute the full requested limits
                    slot_limits_list.append(req_limits)

            # Compute merge (SG-6)
            try:
                final_limits = merge_limits(req_limits, slot_limits_list)
            except NarrowingConflictEmptyError as e:
                # Merge is empty -> request is REJECTED with NARROWING_CONFLICT_EMPTY (EC-V09)
                request.status = RequestStatus.REJECTED.value
                db.flush()
                AuditService.append_event(
                    session=db,
                    event_type="REQUEST_REJECTED",
                    subject_type="request",
                    subject_id=request.id,
                    payload={"reason": e.code, "detail": e.message},
                    actor_sub=reviewer_sub,
                    actor_role=slot.slot_role,
                    now=current_time,
                )
                return request, slot, None

            # Mark request APPROVED
            request.status = RequestStatus.APPROVED.value
            db.flush()

            # Mint the Grant (SG-5, SG-6, NFR-6)
            # Idempotent via UNIQUE(grants.request_id)
            existing_grant = db.execute(select(Grant).where(Grant.request_id == request.id)).scalar_one_or_none()
            if existing_grant:
                created_grant = existing_grant
            else:
                grant_id = generate_id("grant")
                activated_at = current_time
                expires_at = activated_at + timedelta(minutes=final_limits.duration_minutes)

                created_grant = Grant(
                    id=grant_id,
                    request_id=request.id,
                    requester_sub=request.requester_sub,
                    resource_id=request.resource_id,
                    purpose_code=request.purpose_code,
                    actions=sorted(list(final_limits.actions)),
                    activated_at=activated_at,
                    expires_at=expires_at,
                    status="ACTIVE",
                    revoke_emergency=False,
                )
                db.add(created_grant)
                db.flush()

                # Build detailed decision summary of who accepted and why
                summary_lines = []
                for s in request.slots:
                    dec_user = db.get(User, s.decided_by_sub) if s.decided_by_sub else None
                    name = dec_user.display_name if dec_user else (s.decided_by_sub or s.assigned_sub)
                    summary_lines.append(f"• {name} ({s.slot_role}): {s.decision} — '{s.rationale or 'Approved under policy controls'}'")

                res = db.get(Resource, request.resource_id)
                res_name = res.name if res else request.resource_id
                approval_summary = "\n".join(summary_lines)

                approval_notif = Notification(
                    id=generate_id("notif"),
                    to_sub=request.requester_sub,
                    kind="REQUEST_APPROVED",
                    ref_id=created_grant.id,
                    message=f"Access request {request.id[:10]} for {res_name} was APPROVED!\n\nReviewer Summary:\n{approval_summary}",
                    created_at=current_time,
                )
                db.add(approval_notif)

                AuditService.append_event(
                    session=db,
                    event_type="REQUEST_APPROVED",
                    subject_type="request",
                    subject_id=request.id,
                    payload={
                        "grant_id": grant_id,
                        "merged_actions": sorted(list(final_limits.actions)),
                        "merged_duration": final_limits.duration_minutes,
                    },
                    actor_sub=reviewer_sub,
                    actor_role=slot.slot_role,
                    now=current_time,
                )

                AuditService.append_event(
                    session=db,
                    event_type="GRANT_ACTIVATED",
                    subject_type="grant",
                    subject_id=grant_id,
                    payload={
                        "request_id": request.id,
                        "resource_id": request.resource_id,
                        "actions": sorted(list(final_limits.actions)),
                        "duration_minutes": final_limits.duration_minutes,
                        "expires_at": expires_at.isoformat(),
                    },
                    actor_sub=reviewer_sub,
                    actor_role=slot.slot_role,
                    now=current_time,
                )

        return request, slot, created_grant
