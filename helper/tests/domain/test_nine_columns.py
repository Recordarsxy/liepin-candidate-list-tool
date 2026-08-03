from __future__ import annotations

from candidate_store.domain.models import CandidateCapture
from candidate_store.domain.nine_columns import NINE_COLUMN_FIELDS, to_nine_column_draft


def test_maps_the_exact_nine_column_order_without_technical_fields() -> None:
    capture = CandidateCapture(
        platform="liepin",
        platform_candidate_id="candidate-002",
        source_page_type="detail",
        current_company="甲银行",
        current_role="机构销售",
        name="已脱敏姓名",
        gender="",
        age="",
        current_location="上海",
        preferred_location="北京",
        master_school="甲大学",
        bachelor_school="乙大学",
    )

    draft = to_nine_column_draft(capture)

    assert NINE_COLUMN_FIELDS == (
        "current_company",
        "name_gender",
        "age",
        "current_location",
        "preferred_location",
        "current_role",
        "master_school",
        "bachelor_school",
    )
    assert draft.fields() == ["甲银行", "已脱敏姓名", "", "上海", "北京", "机构销售", "甲大学", "乙大学"]
    assert not hasattr(draft, "platform_candidate_id")
    assert not hasattr(draft, "assessment")


def test_keeps_unknown_nine_column_values_empty() -> None:
    draft = to_nine_column_draft(
        CandidateCapture(
            platform="liepin",
            platform_candidate_id="candidate-003",
            source_page_type="list",
            current_company="乙基金",
            current_role="渠道销售",
        )
    )

    assert draft.fields() == ["乙基金", "", "", "", "", "渠道销售", "", ""]
