"""SQLAlchemy 2.0 declarative database models matching BLUEPRINT §6.8."""
from datetime import datetime
from typing import Any
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    UniqueConstraint,
    Index,
    Text,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    sub = Column(String(128), primary_key=True)
    display_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    manager_sub = Column(String(128), ForeignKey("users.sub"), nullable=True)
    is_agent = Column(Boolean, default=False, nullable=False)
    owner_sub = Column(String(128), ForeignKey("users.sub"), nullable=True)
    department = Column(String(64), default="General", nullable=False)
    employee_id = Column(String(64), nullable=True)
    delegated_permissions = Column(JSON, nullable=True)  # list of strings for AI agents
    active = Column(Boolean, default=True, nullable=False)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")


class UserRole(Base):
    __tablename__ = "user_roles"

    sub = Column(String(128), ForeignKey("users.sub"), primary_key=True)
    role = Column(String(64), primary_key=True)

    user = relationship("User", back_populates="roles")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    kind = Column(String(32), nullable=False)  # 'model' or 'dataset'
    tier = Column(String(64), nullable=False)  # 'PUBLIC_SYNTHETIC', 'INTERNAL_SYNTHETIC', 'RESTRICTED_SYNTHETIC'
    department = Column(String(64), default="General", nullable=False)
    sensitivity = Column(String(64), default="INTERNAL", nullable=False)  # 'CRITICAL', 'RESTRICTED', 'INTERNAL', 'PUBLIC'
    is_crucial = Column(Boolean, default=False, nullable=False)
    owner_sub = Column(String(128), ForeignKey("users.sub"), nullable=False)
    allowed_actions = Column(JSON, nullable=False)  # list of dicts: {"name": ..., "risk_weight": ...}
    active = Column(Boolean, default=True, nullable=False)


class AccessRequest(Base):
    __tablename__ = "access_requests"

    id = Column(String(64), primary_key=True)
    requester_sub = Column(String(128), ForeignKey("users.sub"), nullable=False)
    resource_id = Column(String(64), ForeignKey("resources.id"), nullable=False)
    purpose_code = Column(String(64), nullable=False)
    purpose_text = Column(Text, nullable=False)
    actions = Column(JSON, nullable=False)  # list of str
    duration_minutes = Column(Integer, nullable=False)
    risk_controls = Column(JSON, nullable=False)  # list of str
    status = Column(String(32), default="IN_REVIEW", nullable=False)
    policy_version = Column(Integer, default=1, nullable=False)
    content_hash = Column(String(64), nullable=False)
    extends_grant_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, nullable=False)

    slots = relationship("ReviewSlot", back_populates="request", cascade="all, delete-orphan")
    grant = relationship("Grant", back_populates="request", uselist=False)


class ReviewSlot(Base):
    __tablename__ = "review_slots"

    id = Column(String(64), primary_key=True)
    request_id = Column(String(64), ForeignKey("access_requests.id"), nullable=False)
    slot_role = Column(String(64), nullable=False)  # 'manager', 'resource_owner', 'risk_reviewer'
    assigned_sub = Column(String(128), ForeignKey("users.sub"), nullable=False)
    status = Column(String(32), default="PENDING", nullable=False)
    decision = Column(String(32), nullable=True)  # 'APPROVED', 'NARROWED', 'REJECTED'
    approved_limits = Column(JSON, nullable=True)  # {"actions": [...], "duration_minutes": ...}
    rationale = Column(Text, nullable=True)
    decided_by_sub = Column(String(128), ForeignKey("users.sub"), nullable=True)
    decided_role = Column(String(64), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    bound_request_hash = Column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint("request_id", "slot_role", name="uq_request_slot_role"),
    )

    request = relationship("AccessRequest", back_populates="slots")


class Grant(Base):
    __tablename__ = "grants"

    id = Column(String(64), primary_key=True)
    request_id = Column(String(64), ForeignKey("access_requests.id"), unique=True, nullable=False)
    requester_sub = Column(String(128), ForeignKey("users.sub"), nullable=False)
    resource_id = Column(String(64), ForeignKey("resources.id"), nullable=False)
    purpose_code = Column(String(64), nullable=False)
    actions = Column(JSON, nullable=False)  # list of str
    activated_at = Column(DateTime, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    status = Column(String(32), default="ACTIVE", nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by_sub = Column(String(128), ForeignKey("users.sub"), nullable=True)
    revoke_reason_code = Column(String(64), nullable=True)
    revoke_emergency = Column(Boolean, default=False, nullable=False)
    suspended_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    invocation_count = Column(Integer, default=0, nullable=False)

    request = relationship("AccessRequest", back_populates="grant")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    seq = Column(Integer, primary_key=True, autoincrement=True)
    id = Column(String(64), nullable=False)
    ts = Column(DateTime, nullable=False)
    type = Column(String(64), nullable=False)
    actor_sub = Column(String(128), nullable=True)
    actor_role = Column(String(64), nullable=True)
    subject_type = Column(String(64), nullable=False)
    subject_id = Column(String(64), nullable=False)
    payload = Column(JSON, nullable=False)
    prev_hash = Column(String(64), nullable=False)
    hash = Column(String(64), nullable=False)

    __table_args__ = (
        Index("idx_audit_type", "type"),
        Index("idx_audit_subject", "subject_type", "subject_id"),
        Index("idx_audit_actor", "actor_sub"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(64), primary_key=True)  # SHA-256 hashed session token
    sub = Column(String(128), ForeignKey("users.sub"), nullable=False)
    csrf_token = Column(String(64), nullable=False)
    created_at = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, nullable=False)
    absolute_expires_at = Column(DateTime, nullable=False)


class AuthTransaction(Base):
    __tablename__ = "auth_transactions"

    state = Column(String(128), primary_key=True)
    nonce = Column(String(128), nullable=False)
    code_verifier = Column(String(128), nullable=False)
    created_at = Column(DateTime, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(64), primary_key=True)
    to_sub = Column(String(128), ForeignKey("users.sub"), nullable=False)
    kind = Column(String(64), nullable=False)
    ref_id = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False)
    read_at = Column(DateTime, nullable=True)


class AIFinding(Base):
    __tablename__ = "ai_findings"

    id = Column(String(64), primary_key=True)
    request_id = Column(String(64), nullable=True)
    grant_id = Column(String(64), nullable=True)
    module = Column(String(64), nullable=False)
    version = Column(String(32), nullable=False)
    score = Column(Integer, nullable=True)
    band = Column(String(32), nullable=True)
    factors = Column(JSON, nullable=False)
    suggestions = Column(JSON, nullable=False)
    summary_text = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=False)
    generated_at = Column(DateTime, nullable=False)


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id = Column(String(64), primary_key=True)
    principal_id = Column(String(128), ForeignKey("users.sub"), nullable=False)
    event_type = Column(String(64), nullable=False)  # 'message', 'tool_call', 'tool_result', 'external_send'
    action = Column(String(64), nullable=True)  # 'read_file', 'external_send', etc.
    resource_id = Column(String(64), nullable=True)
    target_destination = Column(String(255), nullable=True)
    label = Column(String(64), default="clean", nullable=False)  # 'untrusted_input', 'sensitive_input', 'clean'
    payload = Column(JSON, nullable=True)
    timestamp = Column(DateTime, nullable=False)


class EventDependency(Base):
    __tablename__ = "event_dependencies"

    id = Column(String(64), primary_key=True)
    event_id = Column(String(64), ForeignKey("agent_events.id"), nullable=False)
    depends_on_id = Column(String(64), ForeignKey("agent_events.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("event_id", "depends_on_id", name="uq_event_dep"),
    )


# ---------------------------------------------------------------------------
# ServiceNow-inspired SecOps Cybersecurity Models
# ---------------------------------------------------------------------------

class SecurityEvent(Base):
    """Immutable log of detected suspicious activities, injection attempts, and WAF decisions."""
    __tablename__ = "security_events"

    id = Column(String(64), primary_key=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    source_ip = Column(String(64), nullable=False, index=True)
    user_sub = Column(String(128), ForeignKey("users.sub"), nullable=True, index=True)
    method = Column(String(16), nullable=False)
    path = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False)  # 'SQLI', 'XSS', 'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'THREAT_INTEL', 'CLEAN'
    pattern_matched = Column(String(128), nullable=True)
    risk_score = Column(Integer, default=0, nullable=False)
    severity = Column(String(32), default="LOW", nullable=False)  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    action_taken = Column(String(32), nullable=False)  # 'ALLOWED', 'FLAGGED', 'RATE_LIMITED', 'BLOCKED'
    repeat_count = Column(Integer, default=1, nullable=False)
    incident_id = Column(String(64), nullable=True, index=True)
    payload_snippet = Column(Text, nullable=True)
    status = Column(String(32), default="LOGGED", nullable=False)


class SecurityIncident(Base):
    """ServiceNow SIR-inspired Security Incident Record."""
    __tablename__ = "security_incidents"

    id = Column(String(64), primary_key=True)  # e.g. 'INC-2026-00101'
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(32), nullable=False)  # 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    priority = Column(String(16), nullable=False)  # 'P1', 'P2', 'P3', 'P4'
    status = Column(String(32), default="NEW", nullable=False)  # 'NEW', 'INVESTIGATING', 'CONTAINED', 'RESOLVED', 'CLOSED'
    source_ip = Column(String(64), nullable=True, index=True)
    user_sub = Column(String(128), ForeignKey("users.sub"), nullable=True, index=True)
    assigned_to = Column(String(128), ForeignKey("users.sub"), nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    investigation_notes = Column(JSON, default=list, nullable=False)


class IpReputation(Base):
    """Dynamic IP threat tracking and WAF restriction state."""
    __tablename__ = "ip_reputations"

    ip = Column(String(64), primary_key=True)
    status = Column(String(32), default="CLEAN", nullable=False)  # 'CLEAN', 'FLAGGED', 'RATE_LIMITED', 'TEMP_BLOCKED', 'PERM_BLOCKED', 'ALLOWLISTED'
    risk_score = Column(Integer, default=0, nullable=False)
    malicious_attempts = Column(Integer, default=0, nullable=False)
    last_seen_at = Column(DateTime, nullable=False)
    blocked_until = Column(DateTime, nullable=True)
    block_reason = Column(String(255), nullable=True)
    manual_override = Column(Boolean, default=False, nullable=False)


class ThreatIntelIndicator(Base):
    """External threat intelligence feed IoC repository."""
    __tablename__ = "threat_intel_indicators"

    id = Column(String(64), primary_key=True)
    type = Column(String(32), nullable=False)  # 'IP', 'DOMAIN', 'URL', 'HASH'
    value = Column(String(255), nullable=False, unique=True, index=True)
    threat_actor = Column(String(128), nullable=True)
    campaign = Column(String(128), nullable=True)
    confidence = Column(Integer, default=80, nullable=False)
    description = Column(Text, nullable=False)
    added_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

