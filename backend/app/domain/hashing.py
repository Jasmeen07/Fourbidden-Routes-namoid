"""Cryptographic hashing, canonical JSON, and audit chain verification."""
import hashlib
import json
from typing import Any

GENESIS_HASH = "0" * 64


def canonical_json(obj: Any) -> str:
    """Produces deterministic, canonical JSON representation (sorted keys, compact)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def compute_event_hash(event_data_without_hash: dict[str, Any], prev_hash: str) -> str:
    """Computes SHA-256( canonical_json(event) || prev_hash )."""
    payload_str = canonical_json(event_data_without_hash)
    combined = payload_str.encode("utf-8") + prev_hash.encode("utf-8")
    return hashlib.sha256(combined).hexdigest()


def compute_request_content_hash(
    requester_sub: str,
    resource_id: str,
    purpose_code: str,
    purpose_text: str,
    actions: list[str],
    duration_minutes: int,
    risk_controls: list[str],
    policy_version: int,
) -> str:
    """Computes SHA-256 fingerprint of request content at submission."""
    data = {
        "requester_sub": requester_sub,
        "resource_id": resource_id,
        "purpose_code": purpose_code,
        "purpose_text": purpose_text,
        "actions": sorted(actions),
        "duration_minutes": duration_minutes,
        "risk_controls": sorted(risk_controls),
        "policy_version": policy_version,
    }
    return hashlib.sha256(canonical_json(data).encode("utf-8")).hexdigest()


def verify_audit_chain(events: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Verifies that an ordered list of audit events maintains a valid, unbroken SHA-256 hash chain:
    - Seq numbers must be contiguous (1, 2, 3...)
    - First event must have prev_hash == GENESIS_HASH
    - Each subsequent event's prev_hash must match the previous event's hash
    - Each event's hash must match compute_event_hash(event_without_hash, prev_hash)
    """
    if not events:
        return {"ok": True, "checked": 0, "first_bad_seq": None}

    expected_prev = GENESIS_HASH
    for i, event in enumerate(events):
        expected_seq = i + 1
        seq = event.get("seq")
        if seq != expected_seq:
            return {"ok": False, "checked": i, "first_bad_seq": seq or expected_seq, "reason": "Non-contiguous sequence"}

        prev_hash = event.get("prev_hash")
        event_hash = event.get("hash")

        if prev_hash != expected_prev:
            return {"ok": False, "checked": i, "first_bad_seq": seq, "reason": "prev_hash mismatch"}

        # Copy and strip hash field to recompute
        data_to_verify = {k: v for k, v in event.items() if k != "hash"}
        recomputed = compute_event_hash(data_to_verify, prev_hash)
        if recomputed != event_hash:
            return {"ok": False, "checked": i, "first_bad_seq": seq, "reason": "Hash mismatch"}

        expected_prev = event_hash

    return {"ok": True, "checked": len(events), "first_bad_seq": None}
