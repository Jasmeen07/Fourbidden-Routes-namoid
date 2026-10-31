"""State machines and transitions for Requests, Review Slots, and Grants."""
from enum import Enum
from app.domain.errors import InvalidStateTransitionError


class RequestStatus(str, Enum):
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    EXPIRED_UNREVIEWED = "EXPIRED_UNREVIEWED"
    BLOCKED = "BLOCKED"


class SlotStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    NARROWED = "NARROWED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class GrantStatus(str, Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"
    SUSPENDED = "SUSPENDED"


# Valid transitions: Current State -> Set of Allowed Next States
REQUEST_TRANSITIONS: dict[RequestStatus, set[RequestStatus]] = {
    RequestStatus.IN_REVIEW: {
        RequestStatus.APPROVED,
        RequestStatus.REJECTED,
        RequestStatus.WITHDRAWN,
        RequestStatus.EXPIRED_UNREVIEWED,
        RequestStatus.BLOCKED,
    },
    RequestStatus.BLOCKED: {
        RequestStatus.IN_REVIEW,
        RequestStatus.REJECTED,
        RequestStatus.WITHDRAWN,
        RequestStatus.EXPIRED_UNREVIEWED,
    },
    # Terminal states
    RequestStatus.APPROVED: set(),
    RequestStatus.REJECTED: set(),
    RequestStatus.WITHDRAWN: set(),
    RequestStatus.EXPIRED_UNREVIEWED: set(),
}

SLOT_TRANSITIONS: dict[SlotStatus, set[SlotStatus]] = {
    SlotStatus.PENDING: {
        SlotStatus.APPROVED,
        SlotStatus.NARROWED,
        SlotStatus.REJECTED,
        SlotStatus.CANCELLED,
    },
    # Terminal states (decided slots are immutable)
    SlotStatus.APPROVED: set(),
    SlotStatus.NARROWED: set(),
    SlotStatus.REJECTED: set(),
    SlotStatus.CANCELLED: set(),
}

GRANT_TRANSITIONS: dict[GrantStatus, set[GrantStatus]] = {
    GrantStatus.ACTIVE: {
        GrantStatus.EXPIRED,
        GrantStatus.REVOKED,
        GrantStatus.SUSPENDED,
    },
    GrantStatus.SUSPENDED: {
        GrantStatus.ACTIVE,  # Reinstatement
        GrantStatus.REVOKED, # Escalation to revocation
        GrantStatus.EXPIRED,
    },
    # Terminal states
    GrantStatus.EXPIRED: set(),
    GrantStatus.REVOKED: set(),
}


def validate_request_transition(current: RequestStatus, target: RequestStatus) -> None:
    if current == target:
        return
    allowed = REQUEST_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidStateTransitionError(
            f"Invalid request transition from {current.value} to {target.value}"
        )


def validate_slot_transition(current: SlotStatus, target: SlotStatus) -> None:
    if current == target:
        return
    allowed = SLOT_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidStateTransitionError(
            f"Invalid review slot transition from {current.value} to {target.value}"
        )


def validate_grant_transition(current: GrantStatus, target: GrantStatus) -> None:
    if current == target:
        return
    allowed = GRANT_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidStateTransitionError(
            f"Invalid grant transition from {current.value} to {target.value}"
        )
