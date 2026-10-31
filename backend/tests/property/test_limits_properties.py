"""Hypothesis property-based tests for Limits algebra laws."""
from hypothesis import given, strategies as st
from app.domain.limits import Limits, merge_limits
from app.domain.errors import NarrowingConflictEmptyError

# Strategy for action sets
actions_strategy = st.sets(st.sampled_from(["query", "batch_query", "read_sample", "read_full", "export_masked"]), min_size=1)
durations_strategy = st.integers(min_value=2, max_value=1440)


@given(
    actions1=actions_strategy,
    dur1=durations_strategy,
    actions2=actions_strategy,
    dur2=durations_strategy,
)
def test_merge_commutative(actions1, dur1, actions2, dur2):
    """merge(A, B) == merge(B, A)."""
    base = Limits("M-1", "BIAS_AUDIT", frozenset(["query", "batch_query", "read_sample", "read_full", "export_masked"]), 2000)
    l1 = Limits("M-1", "BIAS_AUDIT", frozenset(actions1), dur1)
    l2 = Limits("M-1", "BIAS_AUDIT", frozenset(actions2), dur2)

    try:
        m1 = merge_limits(base, [l1, l2])
        m2 = merge_limits(base, [l2, l1])
        assert m1.actions == m2.actions
        assert m1.duration_minutes == m2.duration_minutes
    except NarrowingConflictEmptyError:
        # Both must raise conflict error if intersection is empty
        try:
            merge_limits(base, [l2, l1])
            assert False, "Should have raised NarrowingConflictEmptyError"
        except NarrowingConflictEmptyError:
            pass


@given(
    actions=actions_strategy,
    dur=durations_strategy,
)
def test_merge_idempotent(actions, dur):
    """merge(A, A) == A."""
    base = Limits("M-1", "BIAS_AUDIT", frozenset(actions), dur)
    l = Limits("M-1", "BIAS_AUDIT", frozenset(actions), dur)
    m = merge_limits(base, [l, l])
    assert m.actions == l.actions
    assert m.duration_minutes == l.duration_minutes


@given(
    actions=actions_strategy,
    dur=durations_strategy,
)
def test_merge_never_broader_than_inputs(actions, dur):
    """merge(X, Y) ⊑ X and merge(X, Y) ⊑ Y."""
    base = Limits("M-1", "BIAS_AUDIT", frozenset(actions), dur)
    subset_actions = frozenset(list(actions)[:max(1, len(actions) // 2)])
    l = Limits("M-1", "BIAS_AUDIT", subset_actions, max(2, dur // 2))

    m = merge_limits(base, [l])
    assert m.is_subset_of(base)
    assert m.is_subset_of(l)
