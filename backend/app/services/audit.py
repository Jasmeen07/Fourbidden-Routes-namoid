"""Tamper-evident Audit Service matching BLUEPRINT §6.10."""
import re
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.db.models import AuditEvent
from app.domain.hashing import (
    compute_event_hash,
    verify_audit_chain,
    GENESIS_HASH,
)
from app.domain.errors import DomainError


# Secret and token patterns to reject from audit payloads (EC-L04)
SENSITIVE_PATTERNS = [
    re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'),  # Email pattern
    re.compile(r'(?:bearer\s+[a-zA-Z0-9\-._~+/]+=*)|(?:ey[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})', re.IGNORECASE),  # JWT / Bearer
    re.compile(r'(?:password|secret|api_key|private_key|token)\s*[:=]\s*\S+', re.IGNORECASE),
]


def assert_no_sensitive_values(data: Any) -> None:
    """Recursively checks that payloads contain no emails, tokens, or secrets (EC-L04)."""
    if isinstance(data, dict):
        for k, v in data.items():
            if any(term in k.lower() for term in ["password", "secret", "token", "key"]):
                raise DomainError(f"Forbidden sensitive key '{k}' in audit payload", code="VALIDATION_FAILED")
            assert_no_sensitive_values(v)
    elif isinstance(data, list):
        for item in data:
            assert_no_sensitive_values(item)
    elif isinstance(data, str):
        for pat in SENSITIVE_PATTERNS:
            if pat.search(data):
                raise DomainError(
                    "Sensitive data pattern (email or token) detected in audit payload",
                    code="VALIDATION_FAILED"
                )


def format_iso_ts(dt: Any) -> str:
    """Formats datetime consistently in UTC ISO 8601 string."""
    if isinstance(dt, str):
        return dt
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).isoformat()
    return dt.replace(tzinfo=timezone.utc).isoformat()


class AuditService:
    @staticmethod
    def append_event(
        session: Session,
        event_type: str,
        subject_type: str,
        subject_id: str,
        payload: dict[str, Any],
        actor_sub: str | None = None,
        actor_role: str | None = None,
        event_id: str | None = None,
        now: datetime | None = None,
    ) -> AuditEvent:
        """
        Appends an event inside the caller's transaction.
        Enforces payload schema validation, no sensitive data, and contiguous hash chaining.
        """
        assert_no_sensitive_values(payload)

        ts = now or datetime.now(timezone.utc)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        ts_str = format_iso_ts(ts)

        # Get last event in DB for sequence and hash chain
        last_event = session.execute(
            select(AuditEvent).order_by(desc(AuditEvent.seq)).limit(1)
        ).scalar_one_or_none()

        seq = (last_event.seq + 1) if last_event else 1
        prev_hash = last_event.hash if last_event else GENESIS_HASH
        eid = event_id or f"evt_{seq}_{int(ts.timestamp())}"

        data_to_hash = {
            "seq": seq,
            "id": eid,
            "ts": ts_str,
            "type": event_type,
            "actor_sub": actor_sub,
            "actor_role": actor_role,
            "subject_type": subject_type,
            "subject_id": subject_id,
            "payload": payload,
            "prev_hash": prev_hash,
        }

        h = compute_event_hash(data_to_hash, prev_hash)

        event = AuditEvent(
            seq=seq,
            id=eid,
            ts=ts,
            type=event_type,
            actor_sub=actor_sub,
            actor_role=actor_role,
            subject_type=subject_type,
            subject_id=subject_id,
            payload=payload,
            prev_hash=prev_hash,
            hash=h,
        )

        session.add(event)
        session.flush()
        return event

    @staticmethod
    def verify_chain(session: Session) -> dict[str, Any]:
        """Reads all events in sequence and verifies the cryptographic chain."""
        events = session.execute(
            select(AuditEvent).order_by(AuditEvent.seq.asc())
        ).scalars().all()

        event_dicts = [
            {
                "seq": e.seq,
                "id": e.id,
                "ts": format_iso_ts(e.ts),
                "type": e.type,
                "actor_sub": e.actor_sub,
                "actor_role": e.actor_role,
                "subject_type": e.subject_type,
                "subject_id": e.subject_id,
                "payload": e.payload,
                "prev_hash": e.prev_hash,
                "hash": e.hash,
            }
            for e in events
        ]
        return verify_audit_chain(event_dicts)

    @staticmethod
    def query_events(
        session: Session,
        event_type: str | None = None,
        subject_id: str | None = None,
        actor_sub: str | None = None,
        limit: int = 50,
        before_seq: int | None = None,
    ) -> list[AuditEvent]:
        """Queries audit events with optional filters and cursor pagination."""
        stmt = select(AuditEvent).order_by(desc(AuditEvent.seq)).limit(limit)
        if event_type:
            stmt = stmt.where(AuditEvent.type == event_type)
        if subject_id:
            stmt = stmt.where(AuditEvent.subject_id == subject_id)
        if actor_sub:
            stmt = stmt.where(AuditEvent.actor_sub == actor_sub)
        if before_seq:
            stmt = stmt.where(AuditEvent.seq < before_seq)

        return list(session.execute(stmt).scalars().all())
