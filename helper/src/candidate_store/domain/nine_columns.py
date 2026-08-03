from __future__ import annotations

from dataclasses import dataclass

from candidate_store.domain.models import CandidateCapture


NINE_COLUMN_FIELDS = (
    "current_company",
    "name_gender",
    "age",
    "current_location",
    "preferred_location",
    "current_role",
    "master_school",
    "bachelor_school",
)


@dataclass(frozen=True)
class NineColumnDraft:
    current_company: str = ""
    name_gender: str = ""
    age: str = ""
    current_location: str = ""
    preferred_location: str = ""
    current_role: str = ""
    master_school: str = ""
    bachelor_school: str = ""

    def fields(self) -> list[str]:
        return [getattr(self, name) for name in NINE_COLUMN_FIELDS]


def to_nine_column_draft(capture: CandidateCapture) -> NineColumnDraft:
    """Map only the fixed DingTalk-facing fields; unknown values remain blank."""

    return NineColumnDraft(
        current_company=capture.current_company,
        name_gender=_join_visible(capture.name, capture.gender),
        age=capture.age,
        current_location=capture.current_location,
        preferred_location=capture.preferred_location,
        current_role=capture.current_role,
        master_school=capture.master_school,
        bachelor_school=capture.bachelor_school,
    )


def _join_visible(name: str, gender: str) -> str:
    return " / ".join(value for value in (name, gender) if value)
