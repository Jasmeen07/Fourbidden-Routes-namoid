"""Provenance and Event Dependency Graph Domain (FORGE §3, §5.4).

Pure, deterministic evaluation of information-flow dependencies, taint propagation,
and network guardrails.
Conforms to strict domain layering (no I/O, no DB, no network, no datetime.now).
"""
from dataclasses import dataclass
from typing import Sequence, Any


@dataclass(frozen=True)
class EventNode:
    id: str
    event_type: str  # 'message', 'tool_call', 'tool_result', 'external_send'
    action: str  # 'read_file', 'external_send', 'execute_model', etc.
    principal_id: str
    resource_id: str | None = None
    destination: str | None = None
    target_destination: str | None = None  # external URL or domain for network sends
    label: str = "clean"  # 'untrusted_input', 'sensitive_input', 'clean'
    timestamp_iso: str | None = None
    timestamp: Any = None
    payload: Any = None

    def __post_init__(self):
        dest = self.target_destination or self.destination
        if dest and not self.destination:
            object.__setattr__(self, "destination", dest)
        if dest and not self.target_destination:
            object.__setattr__(self, "target_destination", dest)
        if self.timestamp and not self.timestamp_iso:
            ts_val = self.timestamp.isoformat() if hasattr(self.timestamp, "isoformat") else str(self.timestamp)
            object.__setattr__(self, "timestamp_iso", ts_val)


@dataclass(frozen=True)
class EventEdge:
    event_id: str = ""
    depends_on_id: str = ""
    source_id: str | None = None
    target_id: str | None = None

    def __post_init__(self):
        ev = self.event_id or self.target_id or ""
        dep = self.depends_on_id or self.source_id or ""
        object.__setattr__(self, "event_id", ev)
        object.__setattr__(self, "depends_on_id", dep)
        object.__setattr__(self, "target_id", ev)
        object.__setattr__(self, "source_id", dep)


@dataclass(frozen=True)
class ProvenanceGraph:
    nodes: dict[str, EventNode]
    edges: tuple[EventEdge, ...]


# Network Team Guardrail: Corporate Approved Outbound Destinations
DEFAULT_APPROVED_DESTINATIONS = frozenset({
    "api.internal.corp",
    "backup.internal.corp",
    "vault.internal.corp",
    "verified-partner.corp",
})


def compute_taint_and_secrets(graph: ProvenanceGraph) -> dict[str, set[str]]:
    """Computes propagated labels (tainted, has_secret) through the dependency graph to fixed point.

    Rules matching FORGE §5.4:
    Tainted(e) :- UntrustedInput(e).
    Tainted(e) :- DependsOn(e, e'), Tainted(e').
    HasSecret(e) :- SensitiveInput(e).
    HasSecret(e) :- DependsOn(e, e'), HasSecret(e').
    """
    labels: dict[str, set[str]] = {node_id: set() for node_id in graph.nodes}

    # Step 1: Base facts from initial node labels
    for node_id, node in graph.nodes.items():
        if node.label == "untrusted_input":
            labels[node_id].add("untrusted_input")
            labels[node_id].add("tainted")
        elif node.label == "sensitive_input":
            labels[node_id].add("sensitive_input")
            labels[node_id].add("has_secret")

    # Step 2: Iterative fixed-point propagation over dependency edges
    # Note: Edge means 'event_id' depends on 'depends_on_id'
    changed = True
    iterations = 0
    max_iterations = len(graph.nodes) + 10

    while changed and iterations < max_iterations:
        changed = False
        iterations += 1

        for edge in graph.edges:
            child_id = edge.event_id
            parent_id = edge.depends_on_id

            if parent_id not in labels or child_id not in labels:
                continue

            parent_labels = labels[parent_id]
            child_labels = labels[child_id]

            if "tainted" in parent_labels and "tainted" not in child_labels:
                child_labels.add("tainted")
                changed = True

            if "has_secret" in parent_labels and "has_secret" not in child_labels:
                child_labels.add("has_secret")
                changed = True

    return labels


def find_influencing_sources(event_id: str, graph: ProvenanceGraph) -> dict[str, list[str]]:
    """Traverses the dependency graph backwards to identify which specific untrusted inputs
    and sensitive inputs influenced this event."""
    untrusted_sources: list[str] = []
    sensitive_sources: list[str] = []

    # Map each child to its parents
    parent_map: dict[str, list[str]] = {}
    for edge in graph.edges:
        parent_map.setdefault(edge.event_id, []).append(edge.depends_on_id)

    visited: set[str] = set()
    queue = [event_id]

    while queue:
        curr = queue.pop(0)
        if curr in visited:
            continue
        visited.add(curr)

        node = graph.nodes.get(curr)
        if node:
            if node.label == "untrusted_input":
                untrusted_sources.append(curr)
            elif node.label == "sensitive_input":
                sensitive_sources.append(curr)

        for parent in parent_map.get(curr, []):
            if parent not in visited:
                queue.append(parent)

    return {
        "untrusted_inputs": untrusted_sources,
        "sensitive_inputs": sensitive_sources,
    }


def evaluate_network_guardrails(
    action: str,
    destination: str | None,
    propagated_labels: set[str],
    approved_destinations: set[str] | frozenset[str] = DEFAULT_APPROVED_DESTINATIONS,
) -> tuple[bool, str | None, str | None]:
    """Evaluates Network Team Guardrails (FORGE §2.1, §5.4, §14):

    1. Tainted Sensitive Exfiltration:
       Deny(a) :- ExternalSend(a), Tainted(a), HasSecret(a).
    2. Destination Allowlist:
       Deny(a) :- ExternalSend(a), not ApprovedDestination(a).
    """
    is_external_send = (action == "external_send" or destination is not None)

    if not is_external_send:
        return True, None, None

    # Guardrail 1: Block exfiltration of tainted data containing secrets
    is_tainted = "tainted" in propagated_labels
    has_secret = "has_secret" in propagated_labels

    if is_tainted and has_secret:
        return False, "Exfiltration blocked: Candidate action is influenced by untrusted input and carries sensitive data.", "TAINTED_SENSITIVE_FLOW_POLICY"

    # Guardrail 2: Enforce network destination allowlist for the network team
    if destination:
        # Strip protocol if present
        clean_dest = destination.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        if clean_dest not in approved_destinations:
            return False, f"Network Guardrail violation: Outbound destination '{clean_dest}' is not on the corporate approved destination allowlist.", "NETWORK_DESTINATION_POLICY"

    return True, None, None
