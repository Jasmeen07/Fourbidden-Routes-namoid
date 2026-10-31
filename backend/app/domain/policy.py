"""Policy model, loader, validation, and lint helpers."""
from typing import Literal
import yaml
from pydantic import BaseModel, ConfigDict, Field


class PolicyLimits(BaseModel):
    model_config = ConfigDict(extra="forbid")
    min_duration_minutes: int = 2
    max_duration_minutes_by_tier: dict[str, int]
    max_cumulative_minutes_with_extensions: int = 20160
    request_pending_ttl_hours: int = 72


class RiskControlsPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    catalog: list[str]
    required_by_tier: dict[str, list[str]]


class RevocationPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    allowed_revokers: list[str]
    reason_codes: list[str]


class ExtensionPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["new_request"] = "new_request"


class PolicyConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = 1
    assumption_notice: str
    limits: PolicyLimits
    approval_matrix: dict[str, list[str]]
    purposes: list[str]
    risk_controls: RiskControlsPolicy
    revocation: RevocationPolicy
    extension: ExtensionPolicy


def parse_policy_yaml(content: str) -> PolicyConfig:
    """Parses and validates policy YAML content."""
    raw = yaml.safe_load(content)
    return PolicyConfig.model_validate(raw)


def lint_policy(policy: PolicyConfig) -> list[str]:
    """
    Assurance engineering linter for policy consistency:
    - Verifies min_duration <= max_duration
    - Verifies required controls are in the catalog
    - Verifies approval matrix roles are valid roles
    - Verifies max duration is <= max cumulative
    """
    findings: list[str] = []

    for tier, max_dur in policy.limits.max_duration_minutes_by_tier.items():
        if max_dur < policy.limits.min_duration_minutes:
            findings.append(f"Tier {tier} max duration ({max_dur}) is less than min duration ({policy.limits.min_duration_minutes})")
        if max_dur > policy.limits.max_cumulative_minutes_with_extensions:
            findings.append(f"Tier {tier} max duration ({max_dur}) exceeds cumulative extension cap ({policy.limits.max_cumulative_minutes_with_extensions})")

    catalog_set = set(policy.risk_controls.catalog)
    for tier, controls in policy.risk_controls.required_by_tier.items():
        for c in controls:
            if c not in catalog_set:
                findings.append(f"Required control '{c}' for tier {tier} not in catalog")

    valid_roles = {"manager", "resource_owner", "risk_reviewer"}
    for tier, reviewers in policy.approval_matrix.items():
        if not reviewers:
            findings.append(f"Approval matrix for tier {tier} has empty reviewers list")
        for r in reviewers:
            if r not in valid_roles:
                findings.append(f"Unknown reviewer role '{r}' in approval matrix for tier {tier}")

    return findings
