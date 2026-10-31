"""Innovation Module 1: Risk Lens - Explainable Risk Scoring and Counterfactual Narrowing (BLUEPRINT §14.3)."""
import math
from datetime import datetime, timezone
from app.ai.schemas import Factor, Suggestion, Finding
from app.domain.limits import Limits


def calculate_risk(
    tier: str,
    action_weights: dict[str, int],
    requested_actions: list[str],
    duration_minutes: int,
    risk_controls: list[str],
    now: datetime | None = None,
) -> tuple[int, list[Factor]]:
    factors: list[Factor] = []

    # 1. Tier baseline factor
    tier_points = {
        "PUBLIC_SYNTHETIC": 10.0,
        "INTERNAL_SYNTHETIC": 30.0,
        "RESTRICTED_SYNTHETIC": 50.0,
    }.get(tier, 30.0)
    factors.append(
        Factor(
            id="f_tier",
            label="Resource Sensitivity Tier",
            points=tier_points,
            max_points=50.0,
            evidence={"tier": tier},
        )
    )

    # 2. Action sensitivity factor
    total_action_weight = sum(action_weights.get(a, 2) for a in requested_actions)
    # Scale action points (max 30)
    action_points = min(30.0, total_action_weight * 3.5)
    factors.append(
        Factor(
            id="f_actions",
            label="Requested Action Privileges",
            points=round(action_points, 1),
            max_points=30.0,
            evidence={
                "actions": requested_actions,
                "weights": {a: action_weights.get(a, 2) for a in requested_actions},
            },
        )
    )

    # 3. Duration exposure factor
    # Bracketed points
    if duration_minutes <= 10:
        dur_points = 5.0
    elif duration_minutes <= 60:
        dur_points = 12.0
    elif duration_minutes <= 1440:
        dur_points = 20.0
    else:
        dur_points = 25.0

    factors.append(
        Factor(
            id="f_duration",
            label="Temporal Exposure Window",
            points=dur_points,
            max_points=25.0,
            evidence={"duration_minutes": duration_minutes},
        )
    )

    # 4. Mitigation controls factor (reduces risk)
    mitigation_points = -min(15.0, len(risk_controls) * 3.0)
    factors.append(
        Factor(
            id="f_controls",
            label="Declared Safety Controls",
            points=mitigation_points,
            max_points=0.0,
            evidence={"controls_count": len(risk_controls), "controls": risk_controls},
        )
    )

    total_score = max(5, min(100, int(sum(f.points for f in factors))))
    return total_score, factors


def compute_risk_lens_finding(
    tier: str,
    action_weights: dict[str, int],
    requested_actions: list[str],
    duration_minutes: int,
    risk_controls: list[str],
    now: datetime | None = None,
) -> Finding:
    current_time = now or datetime.now(timezone.utc)
    base_score, factors = calculate_risk(
        tier, action_weights, requested_actions, duration_minutes, risk_controls, current_time
    )

    # Determine band
    if base_score <= 35:
        band = "low"
    elif base_score <= 70:
        band = "medium"
    else:
        band = "high"

    # Counterfactual search over narrowing lattice
    suggestions: list[Suggestion] = []

    # Counterfactual 1: Drop individual high-weight actions
    if len(requested_actions) > 1:
        for act in requested_actions:
            remaining = [a for a in requested_actions if a != act]
            sub_score, _ = calculate_risk(
                tier, action_weights, remaining, duration_minutes, risk_controls, current_time
            )
            delta = base_score - sub_score
            if delta > 0:
                suggestions.append(
                    Suggestion(
                        kind="drop_action",
                        params={
                            "action": act,
                            "suggested_actions": remaining,
                            "duration_minutes": duration_minutes,
                        },
                        rationale_factor_ids=["f_actions"],
                        expected_effect={
                            "new_score": sub_score,
                            "score_reduction": delta,
                            "new_band": "low" if sub_score <= 35 else ("medium" if sub_score <= 70 else "high"),
                        },
                    )
                )

    # Counterfactual 2: Halve duration
    if duration_minutes > 10:
        halved_dur = max(2, duration_minutes // 2)
        dur_score, _ = calculate_risk(
            tier, action_weights, requested_actions, halved_dur, risk_controls, current_time
        )
        dur_delta = base_score - dur_score
        if dur_delta > 0:
            suggestions.append(
                Suggestion(
                    kind="narrow_duration",
                    params={
                        "suggested_duration_minutes": halved_dur,
                        "actions": requested_actions,
                    },
                    rationale_factor_ids=["f_duration"],
                    expected_effect={
                        "new_score": dur_score,
                        "score_reduction": dur_delta,
                        "new_band": "low" if dur_score <= 35 else ("medium" if dur_score <= 70 else "high"),
                    },
                )
            )

    # Sort suggestions by greatest risk reduction
    suggestions.sort(key=lambda s: s.expected_effect.get("score_reduction", 0), reverse=True)

    return Finding(
        module="risk_lens",
        version="1.0.0",
        score=base_score,
        band=band,
        factors=factors,
        suggestions=suggestions[:3],
        generated_at=current_time,
    )
