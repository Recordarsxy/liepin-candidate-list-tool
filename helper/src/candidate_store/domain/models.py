from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssessmentOutcome(StrEnum):
    RECOMMEND = "recommend"
    REJECT = "reject"
    NEEDS_REVIEW = "needs_review"


class EvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    field: str = Field(min_length=1, max_length=100)
    polarity: Literal["support", "contrary", "missing"]
    summary: str = Field(min_length=1, max_length=500)


class PoolAssessment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    outcome: AssessmentOutcome
    evidence: list[EvidenceItem] = Field(min_length=1, max_length=3)

    @field_validator("evidence")
    @classmethod
    def reject_has_contrary_evidence(cls, evidence: list[EvidenceItem], info: object) -> list[EvidenceItem]:
        outcome = info.data.get("outcome")  # type: ignore[attr-defined]
        if outcome is AssessmentOutcome.REJECT and not any(
            item.polarity == "contrary" for item in evidence
        ):
            raise ValueError("reject assessments require contrary evidence")
        return evidence


class CareerEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company: str = ""
    role: str = ""
    period: str = ""
    location: str = ""
    education_level: str = ""
    school: str = ""
    source_field: str = Field(min_length=1, max_length=100)


class CandidateCapture(BaseModel):
    """Structured fields extracted from a user-triggered visible platform DOM."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    platform: Literal["liepin", "maimai"]
    platform_candidate_id: str | None = Field(default=None, max_length=200)
    source_page_type: Literal["list", "detail"]
    current_company: str = ""
    current_role: str = ""
    name: str = ""
    gender: str = ""
    age: str = ""
    current_location: str = ""
    preferred_location: str = ""
    master_school: str = ""
    bachelor_school: str = ""
    career_evidence: list[CareerEvidence] = Field(default_factory=list)
    source_description: str = Field(default="visible DOM fields", max_length=500)
    field_missing: list[str] = Field(default_factory=list)

    @field_validator("platform_candidate_id", mode="before")
    @classmethod
    def normalize_blank_platform_candidate_id(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class DetailQueueItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queue_kind: Literal["recommended_deep_analysis", "nine_column_enrichment"]
    priority: int = Field(ge=0, le=1000)
    status: Literal["pending", "completed", "paused"] = "pending"
    paused_reason: str = ""
