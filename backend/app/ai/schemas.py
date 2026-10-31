"""Glass-box AI foundation schemas per BLUEPRINT §14.2 (AI-1..AI-5)."""
from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, ConfigDict, Field


class Factor(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    label: str
    points: float
    max_points: float
    evidence: dict[str, Any]


class Suggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["narrow_duration", "drop_action", "add_control", "review_usage", "suspend"]
    params: dict[str, Any]
    rationale_factor_ids: list[str]
    expected_effect: dict[str, Any]


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    module: str
    version: str
    score: int | None
    band: Literal["low", "medium", "high"] | None
    factors: list[Factor]
    suggestions: list[Suggestion]
    summary_text: str | None = None
    generated_at: datetime
