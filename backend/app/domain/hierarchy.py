"""Enterprise Organizational Hierarchy & Delegation Domain (FORGE §7, §8).

Pure functional domain logic representing reporting relationships, human-AI agent
hierarchy pairing, and multi-level approval routing for crucial data.
Enforces pure domain layering (no I/O, no DB, no network, no datetime.now).
"""
from dataclasses import dataclass
from typing import Sequence


@dataclass(frozen=True)
class Employee:
    id: str  # e.g., 'E001', 'E050', 'E102'
    name: str
    role: str
    department: str
    manager_id: str | None = None
    email: str | None = None


@dataclass(frozen=True)
class Agent:
    id: str  # e.g., 'AG102'
    name: str
    owner_id: str  # human employee ID who owns and is accountable for the agent
    department: str
    delegated_permissions: tuple[str, ...] = ()
    status: str = "ACTIVE"


@dataclass(frozen=True)
class ApprovalStepSpec:
    slot_role: str
    assigned_sub: str
    level: int  # 1: immediate superior, 2: higher-level, 3: resource owner, 4: security officer
    title: str
    is_crucial_escalation: bool = False


# Default Crucial / High-Sensitivity Resources
CRUCIAL_RESOURCE_IDS = frozenset({
    "finance.csv",
    "D-claims-synth",
    "M-fraudscore-v2",
    "customer_pii.csv",
    "payroll_records.csv",
})


def is_crucial_resource(resource_id: str, tier: str | None = None, sensitivity: str | None = None) -> bool:
    """Returns True if the resource is categorized as crucial data requiring higher-level escalation."""
    if resource_id in CRUCIAL_RESOURCE_IDS:
        return True
    if sensitivity and sensitivity.upper() in {"CRITICAL", "RESTRICTED", "HIGH"}:
        return True
    if tier and tier.upper() in {"RESTRICTED_SYNTHETIC", "CRITICAL"}:
        return True
    return False


def get_principal_department(
    principal_id: str,
    employees: dict[str, Employee],
    agents: dict[str, Agent],
) -> str:
    """Returns the department for a human employee or AI agent."""
    if principal_id in employees:
        return employees[principal_id].department
    if principal_id in agents:
        return agents[principal_id].department
    return "General"


def get_immediate_superior(
    principal_id: str,
    employees: dict[str, Employee],
    agents: dict[str, Agent],
) -> str | None:
    """Returns the immediate superior ID for a human employee or AI agent."""
    if principal_id in agents:
        # For an AI agent, the immediate superior is the manager of its human owner
        owner_id = agents[principal_id].owner_id
        if owner_id in employees:
            return employees[owner_id].manager_id
        return None

    if principal_id in employees:
        return employees[principal_id].manager_id

    return None


def get_seniority_chain(
    principal_id: str,
    employees: dict[str, Employee],
    agents: dict[str, Agent],
) -> list[str]:
    """Returns the ascending chain of managers (from immediate manager up to executive/CEO)."""
    chain: list[str] = []
    current_id = get_immediate_superior(principal_id, employees, agents)

    visited = set()
    while current_id and current_id not in visited:
        visited.add(current_id)
        chain.append(current_id)
        if current_id in employees:
            current_id = employees[current_id].manager_id
        else:
            break

    return chain


def validate_agent_delegation(
    agent_id: str,
    requested_actions: Sequence[str],
    agents: dict[str, Agent],
    owner_permissions: Sequence[str] | None = None,
) -> tuple[bool, str | None]:
    """Validates the delegated-permission constraint for an AI agent (FORGE §7.3).

    Agent permissions are the intersection of:
    1. Owner's eligible permissions
    2. Permissions explicitly delegated to the agent
    """
    if agent_id not in agents:
        return False, f"Agent '{agent_id}' is not recognized in the system"

    agent = agents[agent_id]
    delegated_set = set(agent.delegated_permissions)

    # 1. Must be in agent's delegated permissions
    for act in requested_actions:
        if act not in delegated_set:
            return False, f"Action '{act}' has not been explicitly delegated to agent '{agent_id}'"

    # 2. Must be within owner's permissions if owner permissions provided
    if owner_permissions is not None:
        owner_set = set(owner_permissions)
        for act in requested_actions:
            if act not in owner_set:
                return False, f"Action '{act}' exceeds the authority of human owner '{agent.owner_id}'"

    return True, None


def determine_required_approval_steps(
    requester_id: str,
    resource_id: str,
    resource_dept: str,
    resource_owner_id: str,
    is_crucial: bool,
    employees: dict[str, Employee],
    agents: dict[str, Agent],
    security_officer_id: str = "R001",
) -> list[ApprovalStepSpec]:
    """Dynamically determines the required approval steps according to FORGE §9.2.

    Rules:
    - Standard Access (same dept, non-crucial):
      Approval is taken from the immediate superior.
    - Crucial Data or Cross-Department Access:
      Approval is escalated through:
      1. Immediate Superior (business justification)
      2. Higher-level authority (CTO/CFO/CEO)
      3. Resource Owner (dataset/model authorization)
      4. Risk / Security Officer (security posture)
    """
    steps: list[ApprovalStepSpec] = []
    requester_dept = get_principal_department(requester_id, employees, agents)
    is_cross_dept = (requester_dept.lower() != resource_dept.lower())

    immediate_sup = get_immediate_superior(requester_id, employees, agents)
    seniority_chain = get_seniority_chain(requester_id, employees, agents)

    # 1. Level 1: Immediate Superior (always required for all requests)
    if immediate_sup:
        mgr_name = employees[immediate_sup].name if immediate_sup in employees else immediate_sup
        steps.append(
            ApprovalStepSpec(
                slot_role="manager",
                assigned_sub=immediate_sup,
                level=1,
                title=f"Immediate Superior ({mgr_name})",
                is_crucial_escalation=False,
            )
        )

    # If it is crucial data or cross-department, escalate to higher levels
    if is_crucial or is_cross_dept:
        # 2. Level 2: Higher-level authority in the seniority chain (CTO/CFO/CEO)
        # Skip the immediate manager (who is index 0) and take the next higher executive if present
        higher_authority = seniority_chain[1] if len(seniority_chain) > 1 else None
        if higher_authority and higher_authority != immediate_sup and higher_authority != resource_owner_id:
            exec_name = employees[higher_authority].name if higher_authority in employees else higher_authority
            steps.append(
                ApprovalStepSpec(
                    slot_role="executive",
                    assigned_sub=higher_authority,
                    level=2,
                    title=f"Higher Level Authority ({exec_name})",
                    is_crucial_escalation=True,
                )
            )

        # 3. Level 3: Resource Owner (departmental data owner)
        if resource_owner_id and resource_owner_id != immediate_sup and resource_owner_id != higher_authority:
            owner_name = employees[resource_owner_id].name if resource_owner_id in employees else resource_owner_id
            steps.append(
                ApprovalStepSpec(
                    slot_role="resource_owner",
                    assigned_sub=resource_owner_id,
                    level=3,
                    title=f"Resource Owner ({owner_name})",
                    is_crucial_escalation=True,
                )
            )

        # 4. Level 4: Security Officer / Risk Reviewer (independent review)
        if security_officer_id and security_officer_id != requester_id:
            steps.append(
                ApprovalStepSpec(
                    slot_role="risk_reviewer",
                    assigned_sub=security_officer_id,
                    level=4,
                    title="Security Officer / Risk Reviewer",
                    is_crucial_escalation=True,
                )
            )

    return steps
