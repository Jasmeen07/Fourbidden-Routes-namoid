"""SecOps Pure Domain: Cybersecurity Protection & Monitoring (inspired by ServiceNow SecOps).

Conforms strictly to AGENTS.md Rule 2: Pure domain, no I/O, no DB, no network, no datetime.now, no random.
Time is passed as an injected parameter.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Sequence


@dataclass(frozen=True)
class DetectedThreat:
    category: str  # 'SQLI', 'XSS', 'COMMAND_INJECTION', 'PATH_TRAVERSAL', 'THREAT_INTEL'
    rule_name: str
    matched_snippet: str
    base_severity_score: int


# Compiled attack signatures
_SQLI_PATTERNS = [
    (re.compile(r"(?i)\b(UNION\s+(?:ALL\s+)?SELECT|SELECT\s+.*?\s+FROM|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b"), "SQLI_SQL_KEYWORD_INJECTION", 85),
    (re.compile(r"(?i)(?:'\s*OR\s*['\"]?\d+['\"]?\s*=\s*['\"]?\d+|--|#|/\*.*?\*/)"), "SQLI_TAUTOLOGY_OR_COMMENT", 80),
    (re.compile(r"(?i);\s*(?:WAITFOR\s+DELAY|BENCHMARK|PG_SLEEP)"), "SQLI_TIME_BASED_INJECTION", 90),
    (re.compile(r"(?i)\bEXEC(?:UTE)?\s*\("), "SQLI_EXEC_STORED_PROC", 85),
]

_XSS_PATTERNS = [
    (re.compile(r"(?i)<\s*script\b[^>]*>(.*?)<\s*/\s*script\s*>"), "XSS_SCRIPT_TAG", 75),
    (re.compile(r"(?i)\b(javascript:|vbscript:|data:text/html)"), "XSS_PSEUDO_PROTOCOL", 70),
    (re.compile(r"(?i)\bon(?:error|load|click|mouseover|focus|blur|submit|mouseenter)\s*="), "XSS_EVENT_HANDLER", 75),
    (re.compile(r"(?i)<\s*(?:iframe|object|embed|svg|img)\b[^>]*\bon\w+\s*="), "XSS_TAG_EVENT_INJECTION", 80),
    (re.compile(r"(?i)<\s*iframe\b[^>]*\bsrc\s*="), "XSS_IFRAME_INJECTION", 65),
]

_COMMAND_INJECTION_PATTERNS = [
    (re.compile(r"(?:;|\||&&|\`|\$\()\s*(?:cat\s+/etc/|ls\s+-|rm\s+-rf|curl\s+|wget\s+|sh\b|bash\b|cmd\.exe|powershell)\b"), "CMD_INJ_UNIX_SHELL", 90),
    (re.compile(r"(?i)(?:\b(?:nc|ncat|netcat)\s+-[a-z]*e\b)"), "CMD_INJ_REVERSE_SHELL", 95),
    (re.compile(r"(?i)(?:\b(?:whoami|id|uname\s+-a)\s*(?:;|\||&&))"), "CMD_INJ_RECON", 80),
    (re.compile(r"(?i)(?:/bin/sh|/bin/bash|cmd\.exe|powershell\.exe)"), "CMD_INJ_SHELL_BINARY", 85),
]

_PATH_TRAVERSAL_PATTERNS = [
    (re.compile(r"(?:\.\.[/\\]){2,}"), "PATH_TRAV_DOT_DOT_SLASH", 75),
    (re.compile(r"(?i)(?:/etc/passwd|/etc/shadow|/proc/self/|c:[\\/]windows[\\/]system32)"), "PATH_TRAV_SENSITIVE_FILE", 85),
    (re.compile(r"%2e%2e[%2f%5c]"), "PATH_TRAV_URL_ENCODED", 75),
]

# Sensitive patterns that must NEVER be logged (Rule 6)
_MASK_SECRETS_PATTERN = re.compile(
    r"(?i)(?:password|passwd|token|secret|access_token|authorization|apikey|api_key)\s*[:=]\s*['\"]?([^'\"&\s,]+)['\"]?"
)


def scan_input(text: str) -> list[DetectedThreat]:
    """Scans raw input text against malicious attack patterns.
    
    Returns all detected threats with matched snippets and risk weights.
    """
    if not text or not isinstance(text, str):
        return []

    threats: list[DetectedThreat] = []

    # 1. Check SQLi
    for pattern, name, score in _SQLI_PATTERNS:
        match = pattern.search(text)
        if match:
            snippet = text[max(0, match.start() - 10) : min(len(text), match.end() + 10)]
            threats.append(DetectedThreat("SQLI", name, snippet.strip(), score))
            break

    # 2. Check XSS
    for pattern, name, score in _XSS_PATTERNS:
        match = pattern.search(text)
        if match:
            snippet = text[max(0, match.start() - 10) : min(len(text), match.end() + 10)]
            threats.append(DetectedThreat("XSS", name, snippet.strip(), score))
            break

    # 3. Check Command Injection
    for pattern, name, score in _COMMAND_INJECTION_PATTERNS:
        match = pattern.search(text)
        if match:
            snippet = text[max(0, match.start() - 10) : min(len(text), match.end() + 10)]
            threats.append(DetectedThreat("COMMAND_INJECTION", name, snippet.strip(), score))
            break

    # 4. Check Path Traversal
    for pattern, name, score in _PATH_TRAVERSAL_PATTERNS:
        match = pattern.search(text)
        if match:
            snippet = text[max(0, match.start() - 10) : min(len(text), match.end() + 10)]
            threats.append(DetectedThreat("PATH_TRAVERSAL", name, snippet.strip(), score))
            break

    return threats


def calculate_risk_score(
    threats: Sequence[DetectedThreat],
    repeat_attempts: int = 0,
    is_threat_intel_match: bool = False,
) -> tuple[int, str]:
    """Calculates overall risk score (0-100) and severity band (LOW, MEDIUM, HIGH, CRITICAL)."""
    if not threats and not is_threat_intel_match:
        return 0, "LOW"

    # Base score is the maximum of any detected threat or threat intel indicator
    base_score = 0
    if threats:
        base_score = max(t.base_severity_score for t in threats)

    if is_threat_intel_match:
        base_score = max(base_score, 85)

    # Multi-vector bonus (+10 if multiple distinct categories attacked in same payload)
    categories = {t.category for t in threats}
    if len(categories) > 1:
        base_score += 10

    # Repeat penalty (+5 per prior attempt, capped at +25)
    repeat_penalty = min(repeat_attempts * 5, 25)
    total_score = min(base_score + repeat_penalty, 100)

    # Categorise severity
    if total_score >= 80:
        severity = "CRITICAL"
    elif total_score >= 60:
        severity = "HIGH"
    elif total_score >= 30:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    return total_score, severity


def evaluate_ip_action(
    ip: str,
    risk_score: int,
    repeat_count: int,
    is_allowlisted: bool,
    is_threat_intel: bool,
    is_already_blocked: bool,
) -> tuple[str, str, int]:
    """Evaluates the mitigation action to take for an incoming request.
    
    Returns:
        action: 'ALLOWED' | 'FLAGGED' | 'RATE_LIMITED' | 'BLOCKED'
        reason: human-readable explanation
        block_duration_seconds: temporary block duration (0 if not blocked)
    """
    if is_allowlisted:
        return "ALLOWED", "IP is on trusted organizational allowlist", 0

    if is_already_blocked:
        return "BLOCKED", "IP is actively blocked by security policy", 3600

    if is_threat_intel:
        return "BLOCKED", "IP matched known malicious threat intelligence feed", 7200

    if risk_score >= 80:
        # Critical attack detected -> auto block for 1 hour (3600s)
        return "BLOCKED", f"Critical attack pattern detected (Risk Score: {risk_score})", 3600

    if repeat_count >= 5 or risk_score >= 60:
        # High risk or repeated offenses -> block for 15 minutes (900s)
        return "BLOCKED", f"Repeated suspicious attack attempts ({repeat_count} offenses, Score: {risk_score})", 900

    if repeat_count >= 2 or risk_score >= 30:
        # Medium risk -> Rate limit or flag
        return "RATE_LIMITED", f"Elevated risk score ({risk_score}) - rate limit enforced", 0

    return "ALLOWED", "Normal request activity within security thresholds", 0


def sanitize_content(text: str) -> str:
    """Sanitises user-generated content to prevent XSS rendering (HTML entity encoding)."""
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#x27;")
    )


def mask_sensitive_data(text: str) -> str:
    """Masks credentials, tokens, and passwords from payloads before security logging (Rule 6)."""
    if not text:
        return ""
    # Mask JSON formatted secrets: "password": "...", "token": "..."
    masked = re.sub(
        r'(?i)("?(?:password|passwd|token|secret|access_token|authorization|apikey|api_key)"?\s*:\s*)"?[^",}\s]+"?',
        r'\1"[MASKED]"',
        text,
    )
    # Mask key=value secrets: password=..., token=...
    masked = re.sub(
        r'(?i)((?:password|passwd|token|secret|access_token|authorization|apikey|api_key)\s*=\s*)[^,&\s]+',
        r'\1[MASKED]',
        masked,
    )
    # Mask Bearer tokens
    masked = re.sub(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]+", "Bearer [MASKED]", masked)
    return masked[:250]  # truncate to 250 chars max for compact audit

