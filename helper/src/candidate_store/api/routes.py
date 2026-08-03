from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, status
from pydantic import BaseModel, ConfigDict

from candidate_store.domain.models import CandidateCapture, PoolAssessment
from candidate_store.domain.pool_rules import assess_broad_pool
from candidate_store.domain.nine_columns import NineColumnDraft, to_nine_column_draft
from candidate_store.queue.service import QueueService
from candidate_store.storage.repository import CandidateRepository


class QueueItemResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    queue_kind: str
    priority: int
    status: str


class CaptureResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    candidate_id: int
    assessment: PoolAssessment
    queue_items: list[QueueItemResponse]
    nine_column_draft: NineColumnDraft


def create_app(database_path: Path | str) -> FastAPI:
    repository = CandidateRepository(database_path)
    queue_service = QueueService(repository)
    app = FastAPI(title="Candidate Store")

    @app.post(
        "/captures/liepin",
        response_model=CaptureResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_liepin_capture(capture: CandidateCapture) -> CaptureResponse:
        assessment = assess_broad_pool(capture)
        candidate_id = repository.upsert_capture(capture, assessment)
        queue_items = queue_service.enqueue_for_pool(candidate_id, assessment)
        return CaptureResponse(
            candidate_id=candidate_id,
            assessment=assessment,
            queue_items=[
                QueueItemResponse(
                    queue_kind=item.queue_kind,
                    priority=item.priority,
                    status=item.status,
                )
                for item in queue_items
            ],
            nine_column_draft=to_nine_column_draft(capture),
        )

    return app
