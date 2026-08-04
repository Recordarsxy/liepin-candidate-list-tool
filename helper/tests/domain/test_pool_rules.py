from __future__ import annotations

import pytest

from candidate_store.domain.models import AssessmentOutcome, CandidateCapture, EvidenceItem, PoolAssessment
from candidate_store.domain.pool_rules import assess_broad_pool


def capture(*, company: str, role: str) -> CandidateCapture:
    return CandidateCapture(
        platform="liepin",
        platform_candidate_id="candidate-001",
        source_page_type="list",
        current_company=company,
        current_role=role,
    )


def test_recommends_current_finance_channel_institution_and_interbank_sales_role() -> None:
    assessment = assess_broad_pool(
        capture(company="某商业银行", role="机构及同业渠道销售")
    )

    assert assessment.outcome is AssessmentOutcome.RECOMMEND
    assert assessment.evidence[0].polarity == "support"
    assert "机构" in assessment.evidence[0].summary


def test_rejects_explicit_non_sales_role_even_when_company_is_financial() -> None:
    assessment = assess_broad_pool(
        capture(company="某证券公司", role="软件开发工程师")
    )

    assert assessment.outcome is AssessmentOutcome.REJECT
    assert assessment.evidence[0].polarity == "contrary"
    assert "软件开发" in assessment.evidence[0].summary


def test_marks_ambiguous_current_role_for_review() -> None:
    assessment = assess_broad_pool(capture(company="某金融服务公司", role="客户经理"))

    assert assessment.outcome is AssessmentOutcome.NEEDS_REVIEW
    assert assessment.evidence[0].polarity == "missing"


def test_missing_stable_platform_id_forces_review_even_for_a_matching_role() -> None:
    candidate = capture(company="某商业银行", role="机构及同业渠道销售").model_copy(
        update={"platform_candidate_id": None}
    )

    assessment = assess_broad_pool(candidate)

    assert assessment.outcome is AssessmentOutcome.NEEDS_REVIEW
    assert assessment.evidence[0].field == "platform_candidate_id"


def test_pool_assessment_requires_one_to_three_evidence_items() -> None:
    evidence = EvidenceItem(field="current_role", polarity="support", summary="渠道销售")

    with pytest.raises(ValueError):
        PoolAssessment(outcome=AssessmentOutcome.RECOMMEND, evidence=[])
    with pytest.raises(ValueError):
        PoolAssessment(
            outcome=AssessmentOutcome.RECOMMEND,
            evidence=[evidence, evidence, evidence, evidence],
        )
