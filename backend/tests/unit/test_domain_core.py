from datetime import datetime, timezone, timedelta
import pytest
from app.domain.limits import Limits, validate_narrowing, merge_limits
from app.domain.errors import (
    NarrowNotSubsetError,
    NarrowNoopError,
    NarrowEmptyError,
    NarrowingConflictEmptyError,
    SodSelfReviewError,
    SodDualSlotError,
    NotAssignedError,
    InvalidStateTransitionError,
)
from app.domain.states import (
    RequestStatus,
    SlotStatus,
    GrantStatus,
    validate_request_transition,
    validate_slot_transition,
    validate_grant_transition,
)
from app.domain.sod import Subject, RequestContext, SlotContext, check_sod_and_eligibility
from app.domain.effective import GrantSnapshot, compute_effective_status
from app.domain.pdp import (
    evaluate_access,
    SubjectContext,
    GrantContext,
    InvocationContext,
)
from app.domain.hashing import (
    canonical_json,
    compute_event_hash,
    compute_request_content_hash,
    verify_audit_chain,
    GENESIS_HASH,
)
from app.domain.policy import parse_policy_yaml, lint_policy


# ============================================================================
# Limits Algebra & Narrowing (SG-6, EC-V06..EC-V09)
# ============================================================================

def test_limits_subset():
    base = Limits("M-1", "BIAS_AUDIT", frozenset(["query", "batch_query"]), 60)
    narrowed = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 30)
    broader = Limits("M-1", "BIAS_AUDIT", frozenset(["query", "batch_query", "export"]), 60)
    other_resource = Limits("M-2", "BIAS_AUDIT", frozenset(["query"]), 30)

    assert narrowed.is_subset_of(base)
    assert not base.is_subset_of(narrowed)
    assert not broader.is_subset_of(base)
    assert not other_resource.is_subset_of(base)


@pytest.mark.ec("EC-V06")
def test_narrow_not_subset():
    base = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 30)
    invalid_action = Limits("M-1", "BIAS_AUDIT", frozenset(["query", "batch_query"]), 30)
    invalid_duration = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 60)

    with pytest.raises(NarrowNotSubsetError):
        validate_narrowing(base, invalid_action)

    with pytest.raises(NarrowNotSubsetError):
        validate_narrowing(base, invalid_duration)


@pytest.mark.ec("EC-V07")
def test_narrow_noop():
    base = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 30)
    identical = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 30)

    with pytest.raises(NarrowNoopError):
        validate_narrowing(base, identical)


@pytest.mark.ec("EC-V08")
def test_narrow_empty():
    base = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 30)
    empty_actions = Limits("M-1", "BIAS_AUDIT", frozenset([]), 30)
    zero_duration = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 1)

    with pytest.raises(NarrowEmptyError):
        validate_narrowing(base, empty_actions)

    with pytest.raises(NarrowEmptyError):
        validate_narrowing(base, zero_duration, min_duration_minutes=2)


@pytest.mark.ec("EC-V09")
def test_merge_limits_and_disjoint_conflict():
    base = Limits("M-1", "BIAS_AUDIT", frozenset(["query", "batch_query"]), 60)
    slot1 = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 45)
    slot2 = Limits("M-1", "BIAS_AUDIT", frozenset(["query", "batch_query"]), 30)

    merged = merge_limits(base, [slot1, slot2])
    assert merged.actions == frozenset(["query"])
    assert merged.duration_minutes == 30

    # Disjoint narrowings -> conflict empty error
    disjoint1 = Limits("M-1", "BIAS_AUDIT", frozenset(["query"]), 30)
    disjoint2 = Limits("M-1", "BIAS_AUDIT", frozenset(["batch_query"]), 30)
    with pytest.raises(NarrowingConflictEmptyError):
        merge_limits(base, [disjoint1, disjoint2])


# ============================================================================
# State Machine Transitions
# ============================================================================

def test_state_transitions():
    # Valid request transitions
    validate_request_transition(RequestStatus.IN_REVIEW, RequestStatus.APPROVED)
    validate_request_transition(RequestStatus.IN_REVIEW, RequestStatus.REJECTED)
    validate_request_transition(RequestStatus.IN_REVIEW, RequestStatus.WITHDRAWN)
    validate_request_transition(RequestStatus.IN_REVIEW, RequestStatus.BLOCKED)
    validate_request_transition(RequestStatus.BLOCKED, RequestStatus.IN_REVIEW)

    # Invalid terminal transitions
    with pytest.raises(InvalidStateTransitionError):
        validate_request_transition(RequestStatus.APPROVED, RequestStatus.IN_REVIEW)

    with pytest.raises(InvalidStateTransitionError):
        validate_grant_transition(GrantStatus.REVOKED, GrantStatus.ACTIVE)


# ============================================================================
# Separation of Duties (SG-1, EC-V01, EC-V02, EC-V03, EC-V13)
# ============================================================================

@pytest.mark.ec("EC-V01")
def test_sod_self_review_forbidden():
    req = RequestContext(
        id="req-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        resource_owner_sub="usr_oscar",
        requester_manager_sub="usr_mary",
    )
    # Alice has risk_reviewer role, but is the requester!
    candidate = Subject(sub="usr_alice", roles=frozenset(["requester", "risk_reviewer"]))
    slot = SlotContext(id="slot-1", slot_role="risk_reviewer", assigned_sub="usr_alice")

    with pytest.raises(SodSelfReviewError):
        check_sod_and_eligibility(req, candidate, slot, [])


@pytest.mark.ec("EC-V02")
def test_sod_dual_slot_forbidden():
    req = RequestContext(
        id="req-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        resource_owner_sub="usr_mgr_owner",
        requester_manager_sub="usr_mgr_owner",
    )
    # User holds both manager and resource_owner roles
    candidate = Subject(sub="usr_mgr_owner", roles=frozenset(["manager", "resource_owner"]))
    slot = SlotContext(id="slot-2", slot_role="resource_owner", assigned_sub="usr_mgr_owner")

    existing_decisions = [{"slot_role": "manager", "decided_by_sub": "usr_mgr_owner"}]
    with pytest.raises(SodDualSlotError):
        check_sod_and_eligibility(req, candidate, slot, existing_decisions)


@pytest.mark.ec("EC-V03")
def test_sod_unassigned_or_wrong_role():
    req = RequestContext(
        id="req-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        resource_owner_sub="usr_oscar",
        requester_manager_sub="usr_mary",
    )
    candidate = Subject(sub="usr_stranger", roles=frozenset(["requester"]))
    slot = SlotContext(id="slot-1", slot_role="manager", assigned_sub="usr_mary")

    with pytest.raises(NotAssignedError):
        check_sod_and_eligibility(req, candidate, slot, [])


# ============================================================================
# Effective Status & Derived Authority (EC-G06)
# ============================================================================

@pytest.mark.ec("EC-G06")
def test_derived_effective_status():
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    t_expire = t0 + timedelta(minutes=10)

    grant = GrantSnapshot(
        id="g-1",
        activated_at=t0,
        expires_at=t_expire,
        revoked_at=None,
        stored_status="ACTIVE",
    )

    # Active while now < expires_at
    assert compute_effective_status(grant, t0 + timedelta(minutes=5)) == GrantStatus.ACTIVE

    # Expired even if stored_status is still ACTIVE in DB (sweeper didn't run)
    assert compute_effective_status(grant, t_expire) == GrantStatus.EXPIRED
    assert compute_effective_status(grant, t_expire + timedelta(seconds=1)) == GrantStatus.EXPIRED

    # Revoked overrides expiry
    grant_revoked = GrantSnapshot(
        id="g-2",
        activated_at=t0,
        expires_at=t_expire,
        revoked_at=t0 + timedelta(minutes=2),
    )
    assert compute_effective_status(grant_revoked, t0 + timedelta(minutes=1)) == GrantStatus.REVOKED


# ============================================================================
# Policy Decision Point (PDP) Ordering & Boundaries (EC-G05, EC-P01, EC-P02, EC-P03, EC-P07)
# ============================================================================

@pytest.mark.ec("EC-G05")
def test_pdp_exact_boundary():
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    t_expire = t0 + timedelta(minutes=2)

    subject = SubjectContext(sub="usr_alice", is_active=True)
    grant = GrantContext(
        id="g-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=frozenset(["query"]),
        activated_at=t0,
        expires_at=t_expire,
    )
    inv = InvocationContext(resource_id="M-1", action="query", declared_purpose="BIAS_AUDIT")

    # 1 millisecond before expiry -> ALLOW
    d_allow = evaluate_access(subject, grant, inv, t_expire - timedelta(milliseconds=1))
    assert d_allow.allow is True
    assert d_allow.code is None

    # Exactly at expires_at -> DENY_EXPIRED
    d_deny = evaluate_access(subject, grant, inv, t_expire)
    assert d_deny.allow is False
    assert d_deny.code == "DENY_EXPIRED"


@pytest.mark.ec("EC-P01")
def test_pdp_wrong_purpose():
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    subject = SubjectContext(sub="usr_alice", is_active=True)
    grant = GrantContext(
        id="g-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=frozenset(["query"]),
        activated_at=t0,
        expires_at=t0 + timedelta(minutes=10),
    )
    inv = InvocationContext(resource_id="M-1", action="query", declared_purpose="MODEL_EVALUATION")

    d = evaluate_access(subject, grant, inv, t0 + timedelta(minutes=1))
    assert d.allow is False
    assert d.code == "DENY_PURPOSE_MISMATCH"


@pytest.mark.ec("EC-P02")
def test_pdp_action_not_granted():
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    subject = SubjectContext(sub="usr_alice", is_active=True)
    grant = GrantContext(
        id="g-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=frozenset(["query"]),
        activated_at=t0,
        expires_at=t0 + timedelta(minutes=10),
    )
    inv = InvocationContext(resource_id="M-1", action="batch_query", declared_purpose="BIAS_AUDIT")

    d = evaluate_access(subject, grant, inv, t0 + timedelta(minutes=1))
    assert d.allow is False
    assert d.code == "DENY_ACTION_NOT_GRANTED"


@pytest.mark.ec("EC-P03")
def test_pdp_foreign_grant_no_leakage():
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    subject = SubjectContext(sub="usr_alice", is_active=True)
    foreign_grant = GrantContext(
        id="g-1",
        requester_sub="usr_bob",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=frozenset(["query"]),
        activated_at=t0,
        expires_at=t0 + timedelta(minutes=10),
    )
    inv = InvocationContext(resource_id="M-1", action="query", declared_purpose="BIAS_AUDIT")

    d = evaluate_access(subject, foreign_grant, inv, t0 + timedelta(minutes=1))
    assert d.allow is False
    assert d.code == "DENY_NO_GRANT"


@pytest.mark.ec("EC-P07")
def test_pdp_revoked_beats_expired_order():
    t0 = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
    subject = SubjectContext(sub="usr_alice", is_active=True)
    # Grant is BOTH revoked and expired
    grant = GrantContext(
        id="g-1",
        requester_sub="usr_alice",
        resource_id="M-1",
        purpose_code="BIAS_AUDIT",
        actions=frozenset(["query"]),
        activated_at=t0,
        expires_at=t0 + timedelta(minutes=5),
        revoked_at=t0 + timedelta(minutes=2),
    )
    inv = InvocationContext(resource_id="M-1", action="query", declared_purpose="BIAS_AUDIT")

    # Checked at T+10 (past expiry)
    d = evaluate_access(subject, grant, inv, t0 + timedelta(minutes=10))
    # Order mandates check 3 (revoked) evaluates before check 5 (expired)
    assert d.allow is False
    assert d.code == "DENY_REVOKED"


# ============================================================================
# Audit Chain Verification (EC-L02, EC-L03)
# ============================================================================

@pytest.mark.ec("EC-L02")
def test_audit_chain_tamper_detection():
    # Build a valid chain of 3 events
    events = []
    prev = GENESIS_HASH
    for seq in range(1, 4):
        item = {
            "seq": seq,
            "id": f"evt-{seq}",
            "type": "REQUEST_SUBMITTED",
            "actor_sub": "usr_alice",
            "prev_hash": prev,
            "payload": {"req_id": f"req-{seq}"},
        }
        h = compute_event_hash(item, prev)
        item["hash"] = h
        events.append(item)
        prev = h

    # Valid chain verifies
    assert verify_audit_chain(events)["ok"] is True

    # Mutated event payload
    mutated = [dict(e) for e in events]
    mutated[1]["payload"] = {"req_id": "req-mutated"}
    res_mutate = verify_audit_chain(mutated)
    assert res_mutate["ok"] is False
    assert res_mutate["first_bad_seq"] == 2

    # Deleted event creates non-contiguous seq
    deleted = [events[0], events[2]]
    res_del = verify_audit_chain(deleted)
    assert res_del["ok"] is False
    assert res_del["first_bad_seq"] == 3

    # Reordered events
    reordered = [events[1], events[0], events[2]]
    res_reorder = verify_audit_chain(reordered)
    assert res_reorder["ok"] is False


# ============================================================================
# Policy Parsing & Assurance Linter
# ============================================================================

def test_policy_parse_and_lint():
    with open("config/policy.yaml", "r", encoding="utf-8") as fp:
        content = fp.read()
    policy = parse_policy_yaml(content)
    assert policy.version == 1
    assert len(policy.purposes) > 0

    findings = lint_policy(policy)
    assert len(findings) == 0  # Our seed policy is cleanly linted
