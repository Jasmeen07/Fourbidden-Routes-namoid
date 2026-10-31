"""Derived effective status computation (pure functional)."""
from datetime import datetime, timezone
from app.domain.states import GrantStatus


class GrantSnapshot:
    """Minimal snapshot of grant state for effective status determination."""
    def __init__(
        self,
        id: str,
        activated_at: datetime,
        expires_at: datetime,
        revoked_at: datetime | None = None,
        suspended_at: datetime | None = None,
        stored_status: str | None = None,
    ):
        self.id = id
        self.activated_at = activated_at
        self.expires_at = expires_at
        self.revoked_at = revoked_at
        self.suspended_at = suspended_at
        self.stored_status = stored_status


def compute_effective_status(grant: GrantSnapshot, now: datetime) -> GrantStatus:
    """
    Computes effective status dynamically from timestamps:
    - REVOKED if revoked_at is not None
    - SUSPENDED if suspended_at is not None
    - EXPIRED if now >= expires_at (strict inequality: expires_at boundary is expired)
    - ACTIVE otherwise (now < expires_at and now >= activated_at)
    """
    if grant.revoked_at is not None:
        return GrantStatus.REVOKED
    if grant.suspended_at is not None:
        return GrantStatus.SUSPENDED

    exp = grant.expires_at.replace(tzinfo=timezone.utc) if grant.expires_at.tzinfo is None else grant.expires_at
    n = now.replace(tzinfo=timezone.utc) if now.tzinfo is None else now

    if n >= exp:
        return GrantStatus.EXPIRED
    return GrantStatus.ACTIVE
