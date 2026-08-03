from __future__ import annotations

from dataclasses import dataclass

from candidate_store.domain.models import (
    AssessmentOutcome,
    CandidateCapture,
    EvidenceItem,
    PoolAssessment,
)


@dataclass(frozen=True)
class BroadPoolRules:
    """Auditable V1 keyword rules for the broad finance-sales talent pool."""

    version: str = "broad-pool-v1"
    finance_keywords: tuple[str, ...] = (
        "金融",
        "银行",
        "证券",
        "券商",
        "基金",
        "保险",
        "信托",
        "资管",
        "财富",
    )
    channel_keywords: tuple[str, ...] = ("机构", "同业", "渠道")
    sales_keywords: tuple[str, ...] = ("销售",)
    exclusion_keywords: tuple[str, ...] = (
        "软件开发",
        "开发工程师",
        "程序员",
        "产品经理",
        "财务",
        "会计",
        "法务",
        "行政",
        "人力资源",
    )


DEFAULT_BROAD_POOL_RULES = BroadPoolRules()


def assess_broad_pool(
    capture: CandidateCapture,
    rules: BroadPoolRules = DEFAULT_BROAD_POOL_RULES,
) -> PoolAssessment:
    """Evaluate only current visible structured company and role fields."""

    role = capture.current_role
    company = capture.current_company
    combined = f"{company} {role}"

    exclusion = _first_match(role, rules.exclusion_keywords)
    if exclusion:
        return PoolAssessment(
            outcome=AssessmentOutcome.REJECT,
            evidence=[
                EvidenceItem(
                    field="current_role",
                    polarity="contrary",
                    summary=f"current role contains explicit non-sales exclusion: {exclusion}",
                )
            ],
        )

    finance = _first_match(combined, rules.finance_keywords)
    channel = _first_match(role, rules.channel_keywords)
    sales = _first_match(role, rules.sales_keywords)
    if finance and channel and sales:
        return PoolAssessment(
            outcome=AssessmentOutcome.RECOMMEND,
            evidence=[
                EvidenceItem(
                    field="current_role",
                    polarity="support",
                    summary=(
                        f"current visible role has finance ({finance}), "
                        f"channel/institution/interbank ({channel}), and sales ({sales}) signals"
                    ),
                )
            ],
        )

    return PoolAssessment(
        outcome=AssessmentOutcome.NEEDS_REVIEW,
        evidence=[
            EvidenceItem(
                field="current_role",
                polarity="missing",
                summary="current company or role lacks reliable finance channel/institution/interbank sales signals",
            )
        ],
    )


def _first_match(value: str, keywords: tuple[str, ...]) -> str:
    return next((keyword for keyword in keywords if keyword in value), "")
