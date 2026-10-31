"""Policy Decision Point (PDP) - Pure, deterministic evaluation engine."""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass(frozen=True)
class CheckTrace:
    check_name: str
    status: Literal["pass", "fail", "skipped"]
    detail: str


@dataclass(frozen=True)
class Decision:
    allow: bool
    code: str | None
    trace: list[CheckTrace]


@dataclass(frozen=True)
class SubjectContext:
    sub: str | None
    is_active: bool = True


@dataclass(frozen=True)
class GrantContext:
    id: str
    requester_sub: str
    resource_id: str
    purpose_code: str
    actions: frozenset[str]
    activated_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None
    suspended_at: datetime | None = None


@dataclass(frozen=True)
class InvocationContext:
    resource_id: str
    action: str
    declared_purpose: str | None


def evaluate_access(
    subject: SubjectContext,
    grant: GrantContext | None,
    invocation: InvocationContext,
    now: datetime,
) -> Decision:
    """
    Evaluates protected access in deterministic order per BLUEPRINT §6.6:
    1. Session identity present -> DENY_UNAUTHENTICATED
    2. Grant exists for (sub, resource) -> DENY_NO_GRANT
    3. revoked_at is null -> DENY_REVOKED
    4. suspended_at is null -> DENY_SUSPENDED
    5. now < expires_at (strict) -> DENY_EXPIRED
    6. now >= activated_at -> DENY_NOT_YET_ACTIVE
    7. action in grant.actions -> DENY_ACTION_NOT_GRANTED
    8. declared_purpose == grant.purpose_code -> DENY_PURPOSE_MISMATCH
    """
    trace: list[CheckTrace] = []
    first_fail_code: str | None = None

    def record(name: str, passed: bool, fail_code: str, pass_msg: str, fail_msg: str) -> bool:
        nonlocal first_fail_code
        if first_fail_code is not None:
            trace.append(CheckTrace(check_name=name, status="skipped", detail="Skipped due to prior denial"))
            return False
        if passed:
            trace.append(CheckTrace(check_name=name, status="pass", detail=pass_msg))
            return True
        else:
            first_fail_code = fail_code
            trace.append(CheckTrace(check_name=name, status="fail", detail=fail_msg))
            return False

    # Check 1: Subject identity
    if not record(
        name="session_identity",
        passed=(subject.sub is not None and subject.is_active),
        fail_code="DENY_UNAUTHENTICATED",
        pass_msg=f"Authenticated subject {subject.sub}",
        fail_msg="Unauthenticated session or deactivated subject",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    # Check 2: Grant existence bound to subject and resource
    if not record(
        name="grant_exists",
        passed=(grant is not None and grant.requester_sub == subject.sub and grant.resource_id == invocation.resource_id),
        fail_code="DENY_NO_GRANT",
        pass_msg=f"Found grant {grant.id if grant else ''} matching subject and resource",
        fail_msg=f"No active grant exists for subject {subject.sub} on resource {invocation.resource_id}",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    assert grant is not None  # Guaranteed by check 2

    # Check 3: Revocation (evaluated before expiry for accurate audit explanation)
    if not record(
        name="not_revoked",
        passed=(grant.revoked_at is None),
        fail_code="DENY_REVOKED",
        pass_msg="Grant is not revoked",
        fail_msg=f"Grant was revoked at {grant.revoked_at.isoformat() if grant.revoked_at else ''}",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    # Check 4: Suspension (Sentinel module)
    if not record(
        name="not_suspended",
        passed=(grant.suspended_at is None),
        fail_code="DENY_SUSPENDED",
        pass_msg="Grant is not suspended",
        fail_msg="Grant is currently suspended pending review",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    # Check 5: Expiration (strict: now < expires_at)
    if not record(
        name="not_expired",
        passed=(now < grant.expires_at),
        fail_code="DENY_EXPIRED",
        pass_msg=f"Current time ({now.isoformat()}) is before expiry ({grant.expires_at.isoformat()})",
        fail_msg=f"Grant expired at {grant.expires_at.isoformat()} (current time {now.isoformat()})",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    # Check 6: Activation window
    if not record(
        name="active_window",
        passed=(now >= grant.activated_at),
        fail_code="DENY_NOT_YET_ACTIVE",
        pass_msg=f"Grant is active (activated at {grant.activated_at.isoformat()})",
        fail_msg=f"Grant not yet active until {grant.activated_at.isoformat()}",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    # Check 7: Action within granted actions
    if not record(
        name="action_in_scope",
        passed=(invocation.action in grant.actions),
        fail_code="DENY_ACTION_NOT_GRANTED",
        pass_msg=f"Action '{invocation.action}' is granted in {sorted(list(grant.actions))}",
        fail_msg=f"Action '{invocation.action}' is not in granted actions: {sorted(list(grant.actions))}",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    # Check 8: Purpose matches
    if not record(
        name="purpose_matches",
        passed=(invocation.declared_purpose is not None and invocation.declared_purpose == grant.purpose_code),
        fail_code="DENY_PURPOSE_MISMATCH",
        pass_msg=f"Declared purpose '{invocation.declared_purpose}' matches grant purpose",
        fail_msg=f"Declared purpose '{invocation.declared_purpose}' does not match grant purpose '{grant.purpose_code}'",
    ):
        return Decision(allow=False, code=first_fail_code, trace=trace)

    return Decision(allow=True, code=None, trace=trace)
