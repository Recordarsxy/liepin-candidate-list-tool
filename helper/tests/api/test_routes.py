from __future__ import annotations

import asyncio
from pathlib import Path

import httpx

from candidate_store.api.routes import create_app


def post_capture(app, payload: dict[str, object]) -> httpx.Response:
    async def request() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.post("/captures/liepin", json=payload)

    return asyncio.run(request())


def test_post_liepin_capture_returns_assessment_and_created_queue_item(tmp_path: Path) -> None:
    response = post_capture(
        create_app(tmp_path / "candidate-store.sqlite3"),
        {
            "platform": "liepin",
            "platform_candidate_id": "stable-456",
            "source_page_type": "list",
            "current_company": "甲银行",
            "current_role": "机构及同业渠道销售",
        },
    )

    assert response.status_code == 201
    assert response.json()["assessment"]["outcome"] == "recommend"
    assert response.json()["queue_items"] == [
        {"queue_kind": "nine_column_enrichment", "priority": 100, "status": "pending"}
    ]


def test_capture_endpoint_rejects_raw_page_markup(tmp_path: Path) -> None:
    response = post_capture(
        create_app(tmp_path / "candidate-store.sqlite3"),
        {
            "platform": "liepin",
            "platform_candidate_id": "stable-457",
            "source_page_type": "list",
            "current_company": "甲银行",
            "current_role": "机构销售",
            "raw_html": "<main>do not persist this</main>",
        },
    )

    assert response.status_code == 422


def test_liepin_capture_endpoint_rejects_another_platform(tmp_path: Path) -> None:
    response = post_capture(
        create_app(tmp_path / "candidate-store.sqlite3"),
        {
            "platform": "maimai",
            "platform_candidate_id": "other-platform-1",
            "source_page_type": "list",
            "current_company": "甲银行",
            "current_role": "机构销售",
        },
    )

    assert response.status_code == 422


def test_missing_platform_id_is_needs_review_and_is_not_queued(tmp_path: Path) -> None:
    response = post_capture(
        create_app(tmp_path / "candidate-store.sqlite3"),
        {
            "platform": "liepin",
            "source_page_type": "list",
            "current_company": "甲银行",
            "current_role": "机构及同业渠道销售",
        },
    )

    assert response.status_code == 201
    assert response.json()["assessment"]["outcome"] == "needs_review"
    assert response.json()["queue_items"] == []


def test_repeated_blank_or_whitespace_platform_ids_create_unqueued_review_records(tmp_path: Path) -> None:
    app = create_app(tmp_path / "candidate-store.sqlite3")

    responses = [
        post_capture(
            app,
            {
                "platform": "liepin",
                "platform_candidate_id": platform_candidate_id,
                "source_page_type": "list",
                "current_company": "甲银行",
                "current_role": "机构及同业渠道销售",
            },
        )
        for platform_candidate_id in ("", "   ", "")
    ]

    assert [response.status_code for response in responses] == [201, 201, 201]
    assert len({response.json()["candidate_id"] for response in responses}) == 3
    assert all(response.json()["assessment"]["outcome"] == "needs_review" for response in responses)
    assert all(response.json()["queue_items"] == [] for response in responses)
