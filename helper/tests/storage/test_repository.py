from __future__ import annotations

from pathlib import Path

from candidate_store.domain.models import (
    AssessmentOutcome,
    CandidateCapture,
    DetailQueueItem,
    EvidenceItem,
    PoolAssessment,
)
from candidate_store.queue.service import QueueService
from candidate_store.storage.repository import CandidateRepository


def finance_sales_capture() -> CandidateCapture:
    return CandidateCapture(
        platform="liepin",
        platform_candidate_id="stable-123",
        source_page_type="detail",
        current_company="甲银行",
        current_role="机构销售",
        career_evidence=[
            {
                "company": "甲银行",
                "role": "机构销售",
                "location": "上海",
                "education_level": "master",
                "school": "甲大学",
                "source_field": "visible-detail",
            }
        ],
        source_description="visible detail fields",
        field_missing=["preferred_location"],
    )


def recommend_assessment() -> PoolAssessment:
    return PoolAssessment(
        outcome=AssessmentOutcome.RECOMMEND,
        evidence=[EvidenceItem(field="current_role", polarity="support", summary="机构销售")],
    )


def test_persists_only_structured_candidate_evidence_and_source_metadata(tmp_path: Path) -> None:
    database_path = tmp_path / "candidate-store.sqlite3"
    repository = CandidateRepository(database_path)

    candidate_id = repository.upsert_capture(finance_sales_capture(), recommend_assessment())
    persisted = CandidateRepository(database_path).get_candidate(candidate_id)

    assert persisted["platform"] == "liepin"
    assert persisted["platform_candidate_id"] == "stable-123"
    assert persisted["current_company"] == "甲银行"
    assert persisted["career_evidence"] == [
        {
            "company": "甲银行",
            "role": "机构销售",
            "location": "上海",
            "education_level": "master",
            "school": "甲大学",
            "source_field": "visible-detail",
        }
    ]
    assert persisted["source"]["field_missing"] == ["preferred_location"]
    assert "raw_html" not in persisted
    assert "full_page_text" not in persisted
    assert "raw_html" not in repository.table_columns("candidate_source")


def test_recommendation_creates_a_durable_nine_column_enrichment_queue_item(tmp_path: Path) -> None:
    database_path = tmp_path / "candidate-store.sqlite3"
    repository = CandidateRepository(database_path)
    candidate_id = repository.upsert_capture(finance_sales_capture(), recommend_assessment())

    QueueService(repository).enqueue_for_pool(candidate_id, recommend_assessment())

    queue_items = CandidateRepository(database_path).list_queue_items(candidate_id)
    assert [(item["queue_kind"], item["status"])
            for item in queue_items] == [("nine_column_enrichment", "pending")]


def test_ambiguous_candidate_requires_explicit_review_before_enrichment_queue(tmp_path: Path) -> None:
    repository = CandidateRepository(tmp_path / "candidate-store.sqlite3")
    review_assessment = PoolAssessment(
        outcome=AssessmentOutcome.NEEDS_REVIEW,
        evidence=[EvidenceItem(field="current_role", polarity="missing", summary="role is ambiguous")],
    )
    candidate_id = repository.upsert_capture(finance_sales_capture(), review_assessment)
    queue = QueueService(repository)

    assert queue.enqueue_for_pool(candidate_id, review_assessment) == []
    assert queue.enqueue_for_pool(candidate_id, review_assessment, user_review_approved=True)[0].queue_kind == "nine_column_enrichment"


def test_sparse_list_rescan_preserves_existing_detail_fields_and_career_evidence(tmp_path: Path) -> None:
    repository = CandidateRepository(tmp_path / "candidate-store.sqlite3")
    detailed = finance_sales_capture().model_copy(
        update={"name": "脱敏姓名", "master_school": "甲大学", "bachelor_school": "乙大学"}
    )
    candidate_id = repository.upsert_capture(detailed, recommend_assessment())

    same_candidate_id = repository.upsert_capture(
        CandidateCapture(
            platform="liepin",
            platform_candidate_id="stable-123",
            source_page_type="list",
            current_company="甲银行",
            current_role="机构销售",
        ),
        recommend_assessment(),
    )
    persisted = repository.get_candidate(candidate_id)

    assert same_candidate_id == candidate_id
    assert persisted["name"] == "脱敏姓名"
    assert persisted["master_school"] == "甲大学"
    assert persisted["bachelor_school"] == "乙大学"
    assert persisted["career_evidence"] == [
        {
            "company": "甲银行",
            "role": "机构销售",
            "location": "上海",
            "education_level": "master",
            "school": "甲大学",
            "source_field": "visible-detail",
        }
    ]


def test_reenqueue_preserves_completed_queue_state(tmp_path: Path) -> None:
    repository = CandidateRepository(tmp_path / "candidate-store.sqlite3")
    candidate_id = repository.upsert_capture(finance_sales_capture(), recommend_assessment())
    repository.add_queue_item(
        candidate_id,
        DetailQueueItem(queue_kind="nine_column_enrichment", priority=100, status="completed"),
    )

    QueueService(repository).enqueue_for_pool(candidate_id, recommend_assessment())

    assert repository.list_queue_items(candidate_id) == [
        {"queue_kind": "nine_column_enrichment", "priority": 100, "status": "completed", "paused_reason": ""}
    ]


def test_reenqueue_preserves_paused_queue_state_and_reason(tmp_path: Path) -> None:
    repository = CandidateRepository(tmp_path / "candidate-store.sqlite3")
    candidate_id = repository.upsert_capture(finance_sales_capture(), recommend_assessment())
    repository.add_queue_item(
        candidate_id,
        DetailQueueItem(
            queue_kind="nine_column_enrichment",
            priority=100,
            status="paused",
            paused_reason="user needs to verify education",
        ),
    )

    QueueService(repository).enqueue_for_pool(candidate_id, recommend_assessment())

    assert repository.list_queue_items(candidate_id) == [
        {
            "queue_kind": "nine_column_enrichment",
            "priority": 100,
            "status": "paused",
            "paused_reason": "user needs to verify education",
        }
    ]
