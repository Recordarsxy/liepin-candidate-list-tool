from __future__ import annotations

from candidate_store.domain.models import AssessmentOutcome, DetailQueueItem, PoolAssessment
from candidate_store.storage.repository import CandidateRepository


class QueueService:
    def __init__(self, repository: CandidateRepository) -> None:
        self.repository = repository

    def enqueue_for_pool(
        self,
        candidate_id: int,
        assessment: PoolAssessment,
        *,
        user_review_approved: bool = False,
    ) -> list[DetailQueueItem]:
        if assessment.outcome is AssessmentOutcome.REJECT:
            return []
        if assessment.outcome is AssessmentOutcome.NEEDS_REVIEW and not user_review_approved:
            return []

        item = DetailQueueItem(queue_kind="nine_column_enrichment", priority=100)
        return [self.repository.add_queue_item(candidate_id, item)]
