"""Limits algebra and narrowing validation (pure functional)."""
from dataclasses import dataclass
from app.domain.errors import (
    NarrowNotSubsetError,
    NarrowNoopError,
    NarrowEmptyError,
    NarrowingConflictEmptyError,
)


@dataclass(frozen=True)
class Limits:
    resource_id: str
    purpose_code: str
    actions: frozenset[str]
    duration_minutes: int

    def __post_init__(self) -> None:
        if not isinstance(self.actions, frozenset):
            object.__setattr__(self, "actions", frozenset(self.actions))

    def is_subset_of(self, other: "Limits") -> bool:
        """A ⊑ B iff same resource, same purpose, actions ⊆ other.actions, and duration <= other.duration."""
        if self.resource_id != other.resource_id:
            return False
        if self.purpose_code != other.purpose_code:
            return False
        if not self.actions.issubset(other.actions):
            return False
        if self.duration_minutes > other.duration_minutes:
            return False
        return True


def validate_narrowing(original: Limits, narrowed: Limits, min_duration_minutes: int = 2) -> None:
    """
    Validates that `narrowed` is a valid narrowing of `original`:
    1. Must be a subset (cannot add actions or increase duration, cannot change resource/purpose).
    2. Must not be a no-op (must differ from original).
    3. Must not be empty (actions cannot be empty, duration must be >= min_duration_minutes).
    """
    if narrowed.resource_id != original.resource_id or narrowed.purpose_code != original.purpose_code:
        raise NarrowNotSubsetError("Narrowing cannot alter the target resource or declared purpose")

    if not narrowed.actions.issubset(original.actions):
        added = narrowed.actions - original.actions
        raise NarrowNotSubsetError(f"Narrowing cannot add actions not in original request: {sorted(list(added))}")

    if narrowed.duration_minutes > original.duration_minutes:
        raise NarrowNotSubsetError(
            f"Narrowed duration ({narrowed.duration_minutes}m) cannot exceed requested duration ({original.duration_minutes}m)"
        )

    if narrowed.actions == original.actions and narrowed.duration_minutes == original.duration_minutes:
        raise NarrowNoopError("Narrowing must reduce at least one action or shorten duration. Use Approve instead.")

    if len(narrowed.actions) == 0:
        raise NarrowEmptyError("Narrowed actions cannot be empty. Use Reject if no access should be granted.")

    if narrowed.duration_minutes < min_duration_minutes:
        raise NarrowEmptyError(f"Narrowed duration must be at least {min_duration_minutes} minutes")


def merge_limits(request_limits: Limits, slot_limits: list[Limits]) -> Limits:
    """
    Computes the meet (intersection) of all approved/narrowed limits:
    actions = ⋂ actions_i
    duration = min(duration_i)
    Raises NarrowingConflictEmptyError if the merged actions set is empty.
    """
    if not slot_limits:
        return request_limits

    merged_actions = set(request_limits.actions)
    merged_duration = request_limits.duration_minutes

    for limits in slot_limits:
        if limits.resource_id != request_limits.resource_id or limits.purpose_code != request_limits.purpose_code:
            raise NarrowingConflictEmptyError("Conflicting resource or purpose in decision limits")
        merged_actions.intersection_update(limits.actions)
        merged_duration = min(merged_duration, limits.duration_minutes)

    if not merged_actions:
        raise NarrowingConflictEmptyError("Reviewer narrowings resulted in an empty set of approved actions")

    if merged_duration <= 0:
        raise NarrowingConflictEmptyError("Reviewer narrowings resulted in zero duration")

    return Limits(
        resource_id=request_limits.resource_id,
        purpose_code=request_limits.purpose_code,
        actions=frozenset(merged_actions),
        duration_minutes=merged_duration,
    )
