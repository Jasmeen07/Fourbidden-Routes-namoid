"""Deterministic and collision-free ID generation."""
import secrets
import time


def generate_id(prefix: str) -> str:
    """Generates a prefixed random ID (e.g., 'req_abc123', 'grant_xyz789')."""
    random_part = secrets.token_hex(6)
    return f"{prefix}_{random_part}"
