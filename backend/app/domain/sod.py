"""Separation of duties (SoD) and reviewer eligibility rules (pure functional)."""
from dataclasses import dataclass
from app.domain.errors import SodSelfReviewError, SodDualSlotError, NotAssignedError


@dataclass(frozen=True)
class Subject:
    sub: str
    roles: frozenset[str]
    manager_sub: str | None = None


@dataclass(frozen=True)
class RequestContext:
    id: str
    requester_sub: str
    resource_id: str
    resource_owner_sub: str
    requester_manager_sub: str | None


@dataclass(frozen=True)
class SlotContext:
    id: str
    slot_role: str
    assigned_sub: str


def check_sod_and_eligibility(
    request: RequestContext,
    candidate: Subject,
    slot: SlotContext,
    existing_decisions: list[dict[str, str]],  # [{"slot_role": ..., "decided_by_sub": ...}]
) -> None:
    """
    Checks separation of duties and eligibility at decision time:
    1. SG-1: No self-approval. candidate.sub != request.requester_sub.
    2. One person may fill at most one slot per request (SOD_DUAL_SLOT).
    3. Candidate must be assigned to the slot or eligible for it.
    4. Candidate must hold the role required by the slot.
    """
    # Rule 1: No self-approval (SG-1)
    if candidate.sub == request.requester_sub:
        raise SodSelfReviewError(
            f"User {candidate.sub} is the requester and cannot review their own request",
            details={"requester_sub": request.requester_sub, "candidate_sub": candidate.sub}
        )

    # Rule 2: Separation of duties between slots (SOD_DUAL_SLOT)
    for dec in existing_decisions:
        if dec["decided_by_sub"] == candidate.sub and dec["slot_role"] != slot.slot_role:
            raise SodDualSlotError(
                f"User {candidate.sub} already decided on slot {dec['slot_role']} and cannot decide on slot {slot.slot_role}",
                details={"prior_slot": dec["slot_role"], "current_slot": slot.slot_role}
            )

    # Rule 3: Role eligibility
    if slot.slot_role not in candidate.roles:
        raise NotAssignedError(
            f"User {candidate.sub} does not hold required role '{slot.slot_role}' for this review slot"
        )

    # Role specific assignments
    if slot.slot_role == "manager":
        if request.requester_manager_sub and candidate.sub != request.requester_manager_sub:
            raise NotAssignedError(
                f"User {candidate.sub} is not the designated manager for requester {request.requester_sub}"
            )
    elif slot.slot_role == "resource_owner":
        if candidate.sub != request.resource_owner_sub:
            raise NotAssignedError(
                f"User {candidate.sub} is not the owner of resource {request.resource_id}"
            )
    elif slot.slot_role == "risk_reviewer":
        if "risk_reviewer" not in candidate.roles:
            raise NotAssignedError(f"User {candidate.sub} is not a risk reviewer")
