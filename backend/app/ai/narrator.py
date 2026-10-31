"""Advisory LLM narrator and deterministic template fallback (BLUEPRINT §14.1, §14.2)."""
import re
from typing import Protocol
from app.ai.schemas import Finding


def sanitize_for_llm(text: str, max_chars: int = 500) -> str:
    """Sanitizes untrusted requester text before passing to narrator (AI-5)."""
    # Strip non-printable and control chars
    clean = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    # Cap length
    truncated = clean[:max_chars].strip()
    return f'"{truncated}"'


class LLMNarrator(Protocol):
    async def narrate_finding(self, finding: Finding, purpose_text: str) -> str:
        ...


class TemplateNarrator(LLMNarrator):
    """Deterministic, guaranteed-offline narrator that converts factors into plain English."""
    async def narrate_finding(self, finding: Finding, purpose_text: str) -> str:
        score_str = f"Risk Score: {finding.score}/100 ({finding.band.upper() if finding.band else 'INFO'})."
        
        factor_summaries = []
        for f in finding.factors:
            if f.points > 0:
                factor_summaries.append(f"{f.label}: +{int(f.points)} pts")

        factors_text = "; ".join(factor_summaries) if factor_summaries else "No elevated risk factors detected."
        
        top_suggestion = ""
        if finding.suggestions:
            s = finding.suggestions[0]
            if s.kind == "drop_action":
                top_suggestion = f" Recommendation: Dropping action '{s.params.get('action')}' lowers risk score by {s.expected_effect.get('score_reduction', 0)} pts."
            elif s.kind == "narrow_duration":
                top_suggestion = f" Recommendation: Halving duration to {s.params.get('suggested_duration_minutes')}m lowers risk score by {s.expected_effect.get('score_reduction', 0)} pts."

        return f"{score_str} Primary drivers: {factors_text}.{top_suggestion} (AI Advisory summary of stated purpose: {sanitize_for_llm(purpose_text, 100)})"
