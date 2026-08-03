from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from candidate_store.api.routes import create_app


def test_post_liepin_capture_returns_assessment_and_created_queue_item(tmp_path: Path) -> None:
    client = TestClient(create_app(tmp_path / "candidate-store.sqlite3"))

    response = client.post(
        "/captures/liepin",
        json={
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
    client = TestClient(create_app(tmp_path / "candidate-store.sqlite3"))

    response = client.post(
        "/captures/liepin",
        json={
            "platform": "liepin",
            "platform_candidate_id": "stable-457",
            "source_page_type": "list",
            "current_company": "甲银行",
            "current_role": "机构销售",
            "raw_html": "<main>do not persist this</main>",
        },
    )

    assert response.status_code == 422
