"""ServiceNow Security Incident Response (SIR) Pure Domain Module.

Conforms strictly to AGENTS.md Rule 2:
Pure domain, no I/O, no DB, no network, no datetime.now, no random.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal


@dataclass(frozen=True)
class ServiceNowSirRecord:
    number: str
    short_description: str
    description: str
    severity: Literal["1 - Critical", "2 - High", "3 - Medium", "4 - Low"]
    priority: Literal["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"]
    category: str
    subcategory: str
    state: str  # '1' (New), '2' (In Progress), '3' (Contained), '6' (Resolved), '7' (Closed)
    caller_id: str
    cmdb_ci: str
    correlation_id: str
    work_notes: str
    security_tags: list[str]
    opened_at: str


def map_pdp_violation_to_sir_priority(
    violation_code: str,
    resource_tier: str | None = None,
) -> tuple[str, str, str, str]:
    """Deterministically maps a PDP security violation to ServiceNow severity, priority, and categories.

    Returns: (severity, priority, category, subcategory)
    """
    is_tier1 = resource_tier in ("TIER_1_CRITICAL", "RESTRICTED_SYNTHETIC")
    is_exfiltration = violation_code in (
        "DENY_TAINTED_EXFILTRATION",
        "DENY_NETWORK_DESTINATION_NOT_APPROVED",
    )

    if is_exfiltration or (is_tier1 and violation_code in ("DENY_PURPOSE_MISMATCH", "DENY_ACTION_NOT_GRANTED")):
        return (
            "1 - Critical",
            "1 - Critical",
            "Data Exfiltration & Compliance Breach",
            "Policy Enforcement Point Critical Denial",
        )
    elif violation_code in (
        "DENY_PURPOSE_MISMATCH",
        "DENY_ACTION_NOT_GRANTED",
        "DENY_ACTION_NOT_DELEGATED",
        "DENY_REVOKED",
    ):
        return (
            "2 - High",
            "2 - High",
            "Unauthorized Access Attempt",
            "Purpose / Scope Boundary Violation",
        )
    elif violation_code in ("DENY_SUSPENDED", "DENY_EXPIRED"):
        return (
            "3 - Medium",
            "3 - Moderate",
            "Stale / Suspended Credential Usage",
            "Lifecycle Policy Breach",
        )
    else:
        return (
            "4 - Low",
            "4 - Low",
            "Access Policy Denial",
            "General Access Boundary Check",
        )


def format_servicenow_sir_payload(
    incident_number: str,
    violation_code: str,
    caller_sub: str,
    resource_id: str,
    action: str,
    declared_purpose: str | None,
    pdp_trace: list[dict[str, Any]],
    now: datetime,
    client_ip: str | None = None,
    resource_tier: str | None = None,
) -> dict[str, Any]:
    """Builds a standard ServiceNow REST Table API payload for the `sn_si_incident` table."""
    severity, priority, category, subcat = map_pdp_violation_to_sir_priority(
        violation_code=violation_code,
        resource_tier=resource_tier,
    )

    short_desc = f"[GrantGate PDP] Security Violation: {violation_code} on {resource_id}"

    trace_lines = []
    for step in pdp_trace:
        status_icon = "[PASS]" if step.get("status") in ("pass", "PASS") else "[FAIL]" if step.get("status") in ("fail", "FAIL") else "[SKIP]"
        trace_lines.append(f"  {status_icon} {step.get('check_name', step.get('check', 'unknown'))}: {step.get('detail', '')}")
    trace_formatted = "\n".join(trace_lines) if trace_lines else "  No trace steps recorded."

    description = (
        f"GrantGate Policy Decision Point (PDP) detected and intercepted an unauthorized access attempt.\n\n"
        f"Incident Number: {incident_number}\n"
        f"Denial Reason Code: {violation_code}\n"
        f"Calling Principal (Subject): {caller_sub}\n"
        f"Target Resource (Asset): {resource_id} (Tier: {resource_tier or 'STANDARD'})\n"
        f"Attempted Operation / Action: {action}\n"
        f"Declared Purpose: {declared_purpose or 'None'}\n"
        f"Source IP: {client_ip or 'Internal Gateway'}\n"
        f"Evaluation Timestamp (UTC): {now.isoformat()}\n\n"
        f"PDP Evaluation Decision Trace:\n{trace_formatted}\n\n"
        f"Recommended SecOps Action:\n"
        f"1. Verify whether principal credentials have been compromised.\n"
        f"2. Validate caller intent against legitimate business purpose.\n"
        f"3. If exfiltration attempt, execute WAF gateway IP containment."
    )

    work_notes = (
        f"Automated alert dispatched from GrantGate Policy Decision Point (PDP).\n"
        f"Violation Code: {violation_code} | Principal: {caller_sub} | Target: {resource_id}."
    )

    return {
        "number": incident_number,
        "short_description": short_desc,
        "description": description,
        "severity": severity,
        "priority": priority,
        "category": category,
        "subcategory": subcat,
        "state": "1",  # 1 = New in ServiceNow SIR
        "caller_id": caller_sub,
        "cmdb_ci": resource_id,
        "correlation_id": incident_number,
        "work_notes": work_notes,
        "security_tags": ["GrantGate", "PDP", "ZeroTrust", violation_code],
        "opened_at": now.isoformat(),
        "source": "GrantGate Policy Decision Point",
    }
