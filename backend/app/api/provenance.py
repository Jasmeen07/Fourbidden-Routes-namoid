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
    """Returns the full provenance dependency graph with propagated taint & secret labels."""
    graph, nodes_json, edges_json = _build_provenance_graph(db)
    propagated_labels = compute_taint_and_secrets(graph)

    # Attach computed taint state to each node
    for node in nodes_json:
        node_id = node["id"]
        labels = list(propagated_labels.get(node_id, set()))
        node["propagated_labels"] = labels
        node["is_tainted"] = "tainted" in labels
        node["has_secret"] = "has_secret" in labels

    return {
        "nodes": nodes_json,
        "edges": edges_json,
        "approved_destinations": list(DEFAULT_APPROVED_DESTINATIONS),
        "guardrail_rule": "Deny(a) :- ExternalSend(a), Tainted(a), HasSecret(a)",
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
