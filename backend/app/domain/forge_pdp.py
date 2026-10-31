"""FORGE Reference Monitor & Policy Decision Point (FORGE §2, §6, §13).

Formal policy evaluation combining identity, grants, Datalog deduction,
event graph provenance, and network guardrails into a definitive Allow/Deny verdict
with structured denial feedback.
Conforms to strict domain layering (no I/O, no DB, no network, no datetime.now).
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Sequence
from app.domain.datalog import DatalogEngine, Fact, Rule, NegatedFact
from app.domain.provenance import (
    ProvenanceGraph,
    compute_taint_and_secrets,
    evaluate_network_guardrails,
    DEFAULT_APPROVED_DESTINATIONS,
)
from app.domain.hierarchy import (
    Employee,
    Agent,
    validate_agent_delegation,
    is_crucial_resource,
)


@dataclass(frozen=True)
class ForgeEvaluationContext:
    principal_id: str
    is_agent: bool
    resource_id: str
    action: str
    declared_purpose: str | None
    current_time: datetime
    grant: Any | None = None
    event_id: str | None = None
    target_destination: str | None = None
    provenance_graph: ProvenanceGraph | None = None
    employees: dict[str, Employee] | None = None
    agents: dict[str, Agent] | None = None


@dataclass(frozen=True)
class ForgeVerdict:
    status: str  # 'ALLOWED' or 'DENIED'
    action: str
    resource: str
    reason: str
    policy: str
    derived_facts: tuple[str, ...] = ()
    structured_feedback: dict[str, Any] | None = None


def evaluate_forge_action(ctx: ForgeEvaluationContext) -> ForgeVerdict:
    """Evaluates a candidate action through the FORGE Reference Monitor per §6 and §13.

    Enforces:
    1. Complete Mediation: No action reaches resource without reference monitor verdict.
    2. Deny-Overrides: If Deny is derived, the action is blocked.
    3. Fail-Closed Default-Deny: If Allow is not established, block with structured trace.
    """
    engine = DatalogEngine()

    # Base EDB facts
    engine.add_fact("Principal", ctx.principal_id)
    engine.add_fact("Resource", ctx.resource_id)
    engine.add_fact("Action", ctx.action)

    # 1. Agent and Delegation Checks (FORGE §5.2, §7.3)
    if ctx.is_agent:
        engine.add_fact("Agent", ctx.principal_id)
        if ctx.agents and ctx.principal_id in ctx.agents:
            agent = ctx.agents[ctx.principal_id]
            engine.add_fact("OwnedBy", ctx.principal_id, agent.owner_id)

            # Check explicit delegation
            delegated_ok, err_msg = validate_agent_delegation(
                agent_id=ctx.principal_id,
                requested_actions=[ctx.action],
                agents=ctx.agents,
            )
            if not delegated_ok:
                return ForgeVerdict(
                    status="DENIED",
                    action=ctx.action,
                    resource=ctx.resource_id,
                    reason=err_msg or "Action not delegated to agent",
                    policy="DELEGATION_CONTROL_POLICY",
                    structured_feedback={
                        "status": "DENIED",
                        "action": ctx.action,
                        "resource": ctx.resource_id,
                        "reason": err_msg or "Agent permissions must be explicitly delegated by human owner",
                        "policy": "DELEGATION_CONTROL_POLICY",
                        "principal_id": ctx.principal_id,
                        "owner_id": agent.owner_id,
                    },
                )
            for d_act in agent.delegated_permissions:
                engine.add_fact("DelegatedPermission", ctx.principal_id, d_act)
        else:
            return ForgeVerdict(
                status="DENIED",
                action=ctx.action,
                resource=ctx.resource_id,
                reason=f"Unknown or unauthenticated AI agent '{ctx.principal_id}'",
                policy="AGENT_AUTHENTICATION_POLICY",
                structured_feedback={
                    "status": "DENIED",
                    "action": ctx.action,
                    "resource": ctx.resource_id,
                    "reason": "Agent identity is not registered or linked to an accountable human owner",
                    "policy": "AGENT_AUTHENTICATION_POLICY",
                },
            )

    # 2. Grant and Purpose checks (FORGE §5.3, §13)
    if not ctx.grant:
        return ForgeVerdict(
            status="DENIED",
            action=ctx.action,
            resource=ctx.resource_id,
            reason="No active grant exists for this principal and resource",
            policy="RESOURCE_ACCESS_POLICY",
            structured_feedback={
                "status": "DENIED",
                "action": ctx.action,
                "resource": ctx.resource_id,
                "reason": "No active grant exists for this principal and resource",
                "policy": "RESOURCE_ACCESS_POLICY",
            },
        )

    # Expiry and Revocation checks
    grant = ctx.grant
    if getattr(grant, "revoked_at", None) is not None:
        return ForgeVerdict(
            status="DENIED",
            action=ctx.action,
            resource=ctx.resource_id,
            reason="Grant has been revoked",
            policy="GRANT_REVOCATION_POLICY",
            structured_feedback={
                "status": "DENIED",
                "action": ctx.action,
                "resource": ctx.resource_id,
                "reason": "Grant has been revoked by an authorized authority",
                "policy": "GRANT_REVOCATION_POLICY",
                "revoked_at": str(getattr(grant, "revoked_at", "")),
            },
        )

    expires_at = getattr(grant, "expires_at", None)
    if expires_at:
        # Normalize timezone if needed
        if expires_at.tzinfo is None and ctx.current_time.tzinfo is not None:
            now_cmp = ctx.current_time.replace(tzinfo=None)
        else:
            now_cmp = ctx.current_time

        if now_cmp >= expires_at:
            return ForgeVerdict(
                status="DENIED",
                action=ctx.action,
                resource=ctx.resource_id,
                reason="Grant has expired",
                policy="GRANT_EXPIRY_POLICY",
                structured_feedback={
                    "status": "DENIED",
                    "action": ctx.action,
                    "resource": ctx.resource_id,
                    "reason": "Grant validity period has elapsed",
                    "policy": "GRANT_EXPIRY_POLICY",
                    "expires_at": str(expires_at),
                },
            )

    # Operation and Purpose checks
    grant_actions = set(getattr(grant, "actions", []))
    if ctx.action not in grant_actions:
        return ForgeVerdict(
            status="DENIED",
            action=ctx.action,
            resource=ctx.resource_id,
            reason=f"Operation '{ctx.action}' is outside the approved grant scope",
            policy="LEAST_PRIVILEGE_POLICY",
            structured_feedback={
                "status": "DENIED",
                "action": ctx.action,
                "resource": ctx.resource_id,
                "reason": f"Operation '{ctx.action}' is outside the approved grant scope",
                "policy": "LEAST_PRIVILEGE_POLICY",
                "approved_actions": list(grant_actions),
            },
        )

    grant_purpose = getattr(grant, "purpose_code", None)
    if not ctx.declared_purpose or ctx.declared_purpose != grant_purpose:
        return ForgeVerdict(
            status="DENIED",
            action=ctx.action,
            resource=ctx.resource_id,
            reason=f"Declared purpose '{ctx.declared_purpose}' does not match approved purpose '{grant_purpose}'",
            policy="PURPOSE_LIMITATION_POLICY",
            structured_feedback={
                "status": "DENIED",
                "action": ctx.action,
                "resource": ctx.resource_id,
                "reason": "Use outside the approved purpose is denied",
                "policy": "PURPOSE_LIMITATION_POLICY",
                "approved_purpose": grant_purpose,
                "declared_purpose": ctx.declared_purpose,
            },
        )

    # 3. Provenance and Information-Flow Taint Evaluation (FORGE §3, §5.4)
    if ctx.provenance_graph and ctx.event_id:
        propagated_labels = compute_taint_and_secrets(ctx.provenance_graph)
        node_labels = propagated_labels.get(ctx.event_id, set())

        # Network Guardrails for Network Team and Agent External Sends
        allowed_net, net_reason, net_policy = evaluate_network_guardrails(
            action=ctx.action,
            destination=ctx.target_destination,
            propagated_labels=node_labels,
        )

        if not allowed_net:
            return ForgeVerdict(
                status="DENIED",
                action=ctx.action,
                resource=ctx.resource_id,
                reason=net_reason or "Network guardrail violation",
                policy=net_policy or "NETWORK_GUARDRAIL_POLICY",
                structured_feedback={
                    "status": "DENIED",
                    "action": ctx.action,
                    "resource": ctx.resource_id,
                    "reason": net_reason,
                    "policy": net_policy,
                    "target_destination": ctx.target_destination,
                    "propagated_labels": list(node_labels),
                },
            )

    # 4. If all explicit checks pass, Derive Allow
    engine.add_fact("HasGrant", ctx.principal_id, ctx.resource_id)
    engine.add_fact("AllowedOperation", ctx.principal_id, ctx.resource_id, ctx.action)
    engine.add_fact("AllowedPurpose", ctx.principal_id, ctx.declared_purpose)
    engine.add_rule(
        Fact("Allow", ("P", "R", "Op")),
        Fact("HasGrant", ("P", "R")),
        Fact("AllowedOperation", ("P", "R", "Op")),
        Fact("AllowedPurpose", ("P", "?Purp")),
    )

    all_derived = engine.evaluate()
    derived_strings = tuple(str(f) for f in all_derived)

    if engine.is_true("Allow", ctx.principal_id, ctx.resource_id, ctx.action):
        return ForgeVerdict(
            status="ALLOWED",
            action=ctx.action,
            resource=ctx.resource_id,
            reason="Action conforms to all active grants, agent delegations, and formal FORGE policies",
            policy="FORGE_RUNTIME_MONITOR",
            derived_facts=derived_strings,
            structured_feedback={
                "status": "ALLOWED",
                "action": ctx.action,
                "resource": ctx.resource_id,
                "policy": "FORGE_RUNTIME_MONITOR",
            },
        )

    # Default deny
    return ForgeVerdict(
        status="DENIED",
        action=ctx.action,
        resource=ctx.resource_id,
        reason="Fail-closed default deny: authorization could not be established by formal policy",
        policy="DEFAULT_DENY_POLICY",
        derived_facts=derived_strings,
        structured_feedback={
            "status": "DENIED",
            "action": ctx.action,
            "resource": ctx.resource_id,
            "reason": "No formal rule allowed the candidate action",
            "policy": "DEFAULT_DENY_POLICY",
        },
    )
