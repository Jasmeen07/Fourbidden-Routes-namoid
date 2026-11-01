"""Provenance Event Dependency Graph & Network Guardrails API (FORGE §3, §14)."""
from datetime import datetime, timezone
from typing import Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.engine import get_db
from app.db.models import AgentEvent, EventDependency, User
from app.auth.deps import get_current_user, UserContext, verify_csrf
from app.domain.provenance import (
    EventNode,
    EventEdge,
    ProvenanceGraph,
    compute_taint_and_secrets,
    evaluate_network_guardrails,
    find_influencing_sources,
    DEFAULT_APPROVED_DESTINATIONS,
)

router = APIRouter(prefix="/api/provenance", tags=["provenance"])


class CreateEventPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(..., min_length=2, max_length=64)
    principal_id: str
    event_type: Literal["message", "tool_call", "tool_result", "external_send"]
    action: str | None = None
    resource_id: str | None = None
    target_destination: str | None = None
    label: Literal["clean", "untrusted_input", "sensitive_input"] = "clean"
    payload: Any = None


class AddDependencyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str
    depends_on_id: str


class EvaluateNetworkPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str
    action: str
    target_destination: str | None = None


def _build_provenance_graph(db: Session) -> tuple[ProvenanceGraph, list[dict], list[dict]]:
    db_events = db.execute(select(AgentEvent).order_by(AgentEvent.timestamp.asc())).scalars().all()
    db_deps = db.execute(select(EventDependency)).scalars().all()

    nodes: dict[str, EventNode] = {}
    edges: list[EventEdge] = []

    nodes_json = []
    for e in db_events:
        ts = e.timestamp
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        nodes[e.id] = EventNode(
            id=e.id,
            principal_id=e.principal_id,
            event_type=e.event_type,
            action=e.action,
            resource_id=e.resource_id,
            target_destination=e.target_destination,
            label=e.label,
            payload=e.payload,
            timestamp=ts,
        )
        nodes_json.append({
            "id": e.id,
            "principal_id": e.principal_id,
            "event_type": e.event_type,
            "action": e.action,
            "resource_id": e.resource_id,
            "target_destination": e.target_destination,
            "label": e.label,
            "payload": e.payload,
            "timestamp": ts.isoformat(),
        })

    edges_json = []
    for d in db_deps:
        edges.append(EventEdge(source_id=d.depends_on_id, target_id=d.event_id))
        edges_json.append({
            "id": d.id,
            "source_id": d.depends_on_id,
            "target_id": d.event_id,
        })

    graph = ProvenanceGraph(nodes=nodes, edges=tuple(edges))
    return graph, nodes_json, edges_json


@router.get("/events")
def get_provenance_graph(db: Session = Depends(get_db)):
    """Returns the full provenance dependency graph with propagated taint & secret labels,
    security overview KPIs, live alerts, and enforcement audit trail."""
    graph, nodes_json, edges_json = _build_provenance_graph(db)
    propagated_labels = compute_taint_and_secrets(graph)

    # Attach computed taint state, influences, and guardrail enforcement to each node
    for node in nodes_json:
        node_id = node["id"]
        labels = list(propagated_labels.get(node_id, set()))
        node["propagated_labels"] = labels
        node["is_tainted"] = "tainted" in labels
        node["has_secret"] = "has_secret" in labels

        # Compute causal predecessor influences
        influences = find_influencing_sources(node_id, graph)
        node["untrusted_influences"] = influences.get("untrusted_inputs", [])
        node["sensitive_influences"] = influences.get("sensitive_inputs", [])

        # Evaluate enforcement logic for external sends or destinations
        if node["event_type"] == "external_send" or node.get("target_destination"):
            allowed, reason, policy = evaluate_network_guardrails(
                action=node.get("action") or "external_send",
                destination=node.get("target_destination"),
                propagated_labels=set(labels),
            )
            node["enforcement_status"] = "ALLOWED" if allowed else "BLOCKED"
            node["enforcement_reason"] = reason
            node["enforcement_policy"] = policy
        else:
            node["enforcement_status"] = "MONITORED"
            node["enforcement_reason"] = "Internal execution step monitored by provenance observer."
            node["enforcement_policy"] = None

    # Query active AI agents from DB
    agent_subs_db = set(db.execute(select(User.sub).where(User.is_agent == True)).scalars().all())
    event_agents = set(n["principal_id"] for n in nodes_json if n.get("principal_id"))
    all_agents = sorted(list(agent_subs_db | event_agents))

    # Real-time KPIs calculated from actual data
    total_monitored_events = len(nodes_json)
    risky_events = sum(1 for n in nodes_json if n["is_tainted"] or n["has_secret"])
    blocked_transmissions = sum(1 for n in nodes_json if n.get("enforcement_status") == "BLOCKED")
    active_ai_agents_count = len(all_agents)

    # Generate live Security Alerts based on verified security states
    security_alerts = []
    for n in nodes_json:
        # 1. Suspicious input / Prompt injection risk
        if n["label"] == "untrusted_input" or (n.get("payload") and isinstance(n["payload"], dict) and n["payload"].get("injection_detected")):
            security_alerts.append({
                "id": f"alert_prompt_{n['id']}",
                "event_id": n["id"],
                "severity": "HIGH",
                "category": "SUSPICIOUS_PROMPT",
                "title": f"Untrusted External Input Ingestion ({n['id']})",
                "description": f"Agent {n['principal_id']} ingested unverified prompt/document data ({n.get('resource_id') or n.get('action') or 'external input'}). Taint propagated downstream.",
                "timestamp": n["timestamp"],
                "agent_id": n["principal_id"],
                "action": n.get("action"),
                "status": "ACTIVE_TAINT",
            })

        # 2. Confidential / sensitive data access
        if n["label"] == "sensitive_input" or n.get("resource_id"):
            security_alerts.append({
                "id": f"alert_secret_{n['id']}",
                "event_id": n["id"],
                "severity": "MEDIUM",
                "category": "SENSITIVE_DATA_ACCESS",
                "title": f"Confidential Resource Accessed ({n.get('resource_id') or n['id']})",
                "description": f"Agent {n['principal_id']} accessed sensitive resource '{n.get('resource_id') or 'confidential asset'}'. Confidentiality label HasSecret(e) attached.",
                "timestamp": n["timestamp"],
                "agent_id": n["principal_id"],
                "action": n.get("action"),
                "status": "SECRET_TAGGED",
            })

        # 3. Blocked exfiltration / data leakage attempt
        if n.get("enforcement_status") == "BLOCKED":
            security_alerts.append({
                "id": f"alert_leak_{n['id']}",
                "event_id": n["id"],
                "severity": "CRITICAL",
                "category": "DATA_LEAKAGE_ATTEMPT",
                "title": f"Blocked External Exfiltration ({n.get('target_destination') or n['id']})",
                "description": f"Network Guardrails actively BLOCKED transmission to '{n.get('target_destination')}'. Rule: {n.get('enforcement_policy')}. Reason: {n.get('enforcement_reason')}",
                "timestamp": n["timestamp"],
                "agent_id": n["principal_id"],
                "action": n.get("action"),
                "status": "BLOCKED",
            })

        # 4. Taint-Secret convergence in agent reasoning
        if n["is_tainted"] and n["has_secret"] and n["event_type"] != "external_send":
            security_alerts.append({
                "id": f"alert_dual_{n['id']}",
                "event_id": n["id"],
                "severity": "HIGH",
                "category": "TAINT_SECRET_CONVERGENCE",
                "title": f"Agent Context Tainted with Secrets ({n['id']})",
                "description": f"Agent {n['principal_id']} merged untrusted input with confidential secrets during '{n.get('action')}'. Complete mediation rule Deny(a) primed for any external send.",
                "timestamp": n["timestamp"],
                "agent_id": n["principal_id"],
                "action": n.get("action"),
                "status": "CONVERGENCE_DETECTED",
            })

    # Chronological Audit Trail
    audit_trail = [
        {
            "event_id": n["id"],
            "timestamp": n["timestamp"],
            "agent_id": n["principal_id"],
            "event_type": n["event_type"],
            "action": n.get("action") or "unspecified",
            "target": n.get("target_destination") or n.get("resource_id") or "internal_pipeline",
            "is_tainted": n["is_tainted"],
            "has_secret": n["has_secret"],
            "enforcement_decision": n.get("enforcement_status", "MONITORED"),
            "enforcement_reason": n.get("enforcement_reason"),
            "policy": n.get("enforcement_policy"),
            "payload": n.get("payload"),
        }
        for n in sorted(nodes_json, key=lambda x: x["timestamp"], reverse=True)
    ]

    return {
        "nodes": nodes_json,
        "edges": edges_json,
        "approved_destinations": list(DEFAULT_APPROVED_DESTINATIONS),
        "guardrail_rule": "Deny(a) :- ExternalSend(a), Tainted(a), HasSecret(a)",
        "kpis": {
            "monitored_events": total_monitored_events,
            "risky_events": risky_events,
            "blocked_transmissions": blocked_transmissions,
            "active_ai_agents": active_ai_agents_count,
            "clean_events": total_monitored_events - risky_events,
            "active_agents_list": all_agents,
        },
        "security_alerts": security_alerts,
        "audit_trail": audit_trail,
    }


@router.post("/events", dependencies=[Depends(verify_csrf)])
def create_event(
    payload: CreateEventPayload,
    request: Request,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Logs a new event node into the agent provenance dependency graph."""
    existing = db.get(AgentEvent, payload.id)
    if existing:
        raise HTTPException(status_code=409, detail=f"Event '{payload.id}' already exists")

    clock = getattr(request.app.state, "clock", None)
    now = clock.now() if clock else datetime.now(timezone.utc)

    event = AgentEvent(
        id=payload.id,
        principal_id=payload.principal_id,
        event_type=payload.event_type,
        action=payload.action,
        resource_id=payload.resource_id,
        target_destination=payload.target_destination,
        label=payload.label,
        payload=payload.payload,
        timestamp=now,
    )
    db.add(event)
    db.commit()

    return {"id": event.id, "status": "CREATED"}


@router.post("/dependencies", dependencies=[Depends(verify_csrf)])
def add_event_dependency(
    payload: AddDependencyPayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Adds a causal edge: event_id depends on depends_on_id."""
    ev = db.get(AgentEvent, payload.event_id)
    dep = db.get(AgentEvent, payload.depends_on_id)
    if not ev or not dep:
        raise HTTPException(status_code=404, detail="Event or dependency node not found")

    import uuid
    edge_id = f"dep_{uuid.uuid4().hex[:12]}"
    new_dep = EventDependency(
        id=edge_id,
        event_id=payload.event_id,
        depends_on_id=payload.depends_on_id,
    )
    db.add(new_dep)
    try:
        db.commit()
    except Exception:
        db.rollback()
        return {"status": "ALREADY_EXISTS"}

    return {"id": edge_id, "status": "CONNECTED"}


@router.post("/evaluate")
def evaluate_provenance_and_guardrails(
    payload: EvaluateNetworkPayload,
    db: Session = Depends(get_db),
    user: UserContext = Depends(get_current_user),
):
    """Evaluates network guardrails and exfiltration safety for candidate action."""
    graph, _, _ = _build_provenance_graph(db)
    propagated_labels = compute_taint_and_secrets(graph)
    node_labels = propagated_labels.get(payload.event_id, set())

    allowed, reason, policy = evaluate_network_guardrails(
        action=payload.action,
        destination=payload.target_destination,
        propagated_labels=node_labels,
    )

    return {
        "event_id": payload.event_id,
        "action": payload.action,
        "target_destination": payload.target_destination,
        "status": "ALLOWED" if allowed else "DENIED",
        "reason": reason,
        "policy": policy,
        "labels": list(node_labels),
        "tainted": "tainted" in node_labels,
        "has_secret": "has_secret" in node_labels,
        "approved_destinations": list(DEFAULT_APPROVED_DESTINATIONS),
    }
