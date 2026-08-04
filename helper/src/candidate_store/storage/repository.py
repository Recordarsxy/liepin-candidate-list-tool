from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from pathlib import Path

from candidate_store.domain.models import CandidateCapture, DetailQueueItem, PoolAssessment


class CandidateRepository:
    def __init__(self, database_path: Path | str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def upsert_capture(self, capture: CandidateCapture, assessment: PoolAssessment) -> int:
        values = {
            "platform": capture.platform,
            "platform_candidate_id": capture.platform_candidate_id,
            "current_company": capture.current_company,
            "current_role": capture.current_role,
            "name": capture.name,
            "gender": capture.gender,
            "age": capture.age,
            "current_location": capture.current_location,
            "preferred_location": capture.preferred_location,
            "master_school": capture.master_school,
            "bachelor_school": capture.bachelor_school,
            "pool_outcome": assessment.outcome.value,
            "pool_evidence": json.dumps([item.model_dump() for item in assessment.evidence]),
        }
        with self._connect() as connection:
            candidate_id = self._find_candidate_id(connection, capture)
            if candidate_id is None:
                cursor = connection.execute(
                    """
                    INSERT INTO candidate (
                        platform, platform_candidate_id, current_company, current_role, name, gender, age,
                        current_location, preferred_location, master_school, bachelor_school,
                        pool_outcome, pool_evidence
                    ) VALUES (
                        :platform, :platform_candidate_id, :current_company, :current_role, :name, :gender, :age,
                        :current_location, :preferred_location, :master_school, :bachelor_school,
                        :pool_outcome, :pool_evidence
                    )
                    """,
                    values,
                )
                candidate_id = int(cursor.lastrowid)
            else:
                capture_columns = [
                    "platform_candidate_id",
                    "current_company",
                    "current_role",
                    "name",
                    "gender",
                    "age",
                    "current_location",
                    "preferred_location",
                    "master_school",
                    "bachelor_school",
                ]
                set_clause = ", ".join(
                    f"{column} = COALESCE(NULLIF(:{column}, ''), {column})"
                    for column in capture_columns
                )
                set_clause += ", pool_outcome = :pool_outcome, pool_evidence = :pool_evidence"
                connection.execute(
                    f"UPDATE candidate SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
                    {**values, "id": candidate_id},
                )
                if capture.career_evidence:
                    connection.execute("DELETE FROM career_evidence WHERE candidate_id = ?", (candidate_id,))

            if capture.career_evidence:
                self._insert_evidence(connection, candidate_id, capture)
            connection.execute(
                """
                INSERT INTO candidate_source (candidate_id, platform, scanned_at, page_type, source_description, field_missing)
                VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
                """,
                (
                    candidate_id,
                    capture.platform,
                    capture.source_page_type,
                    capture.source_description,
                    json.dumps(capture.field_missing),
                ),
            )
        return candidate_id

    def add_queue_item(self, candidate_id: int, item: DetailQueueItem) -> DetailQueueItem:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO detail_queue (candidate_id, queue_kind, priority, status, paused_reason)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(candidate_id, queue_kind) DO UPDATE SET
                    priority = excluded.priority,
                    status = CASE
                        WHEN detail_queue.status IN ('completed', 'paused') AND excluded.status = 'pending'
                        THEN detail_queue.status
                        ELSE excluded.status
                    END,
                    paused_reason = CASE
                        WHEN detail_queue.status IN ('completed', 'paused') AND excluded.status = 'pending'
                        THEN detail_queue.paused_reason
                        ELSE excluded.paused_reason
                    END
                """,
                (candidate_id, item.queue_kind, item.priority, item.status, item.paused_reason),
            )
            row = connection.execute(
                """
                SELECT queue_kind, priority, status, paused_reason
                FROM detail_queue WHERE candidate_id = ? AND queue_kind = ?
                """,
                (candidate_id, item.queue_kind),
            ).fetchone()
        return DetailQueueItem.model_validate(dict(row))

    def get_candidate(self, candidate_id: int) -> dict[str, object]:
        with self._connect() as connection:
            candidate = connection.execute("SELECT * FROM candidate WHERE id = ?", (candidate_id,)).fetchone()
            if candidate is None:
                raise KeyError(candidate_id)
            evidence = connection.execute(
                """
                SELECT company, role, period, location, education_level, school, source_field
                FROM career_evidence WHERE candidate_id = ? ORDER BY id
                """,
                (candidate_id,),
            ).fetchall()
            source = connection.execute(
                """
                SELECT platform, page_type, source_description, field_missing
                FROM candidate_source WHERE candidate_id = ? ORDER BY id DESC LIMIT 1
                """,
                (candidate_id,),
            ).fetchone()
        result = dict(candidate)
        result["career_evidence"] = [
            {key: value for key, value in dict(item).items() if value != ""} for item in evidence
        ]
        result["source"] = {
            **dict(source),
            "field_missing": json.loads(source["field_missing"]),
        }
        result["pool_evidence"] = json.loads(result["pool_evidence"])
        return result

    def list_queue_items(self, candidate_id: int) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT queue_kind, priority, status, paused_reason
                FROM detail_queue WHERE candidate_id = ? ORDER BY priority DESC, id
                """,
                (candidate_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def table_columns(self, table_name: str) -> set[str]:
        if table_name not in {"candidate", "career_evidence", "candidate_source", "detail_queue"}:
            raise ValueError("unsupported table")
        with self._connect() as connection:
            rows = connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        return {row["name"] for row in rows}

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS candidate (
                    id INTEGER PRIMARY KEY,
                    platform TEXT NOT NULL,
                    platform_candidate_id TEXT,
                    current_company TEXT NOT NULL DEFAULT '',
                    current_role TEXT NOT NULL DEFAULT '',
                    name TEXT NOT NULL DEFAULT '',
                    gender TEXT NOT NULL DEFAULT '',
                    age TEXT NOT NULL DEFAULT '',
                    current_location TEXT NOT NULL DEFAULT '',
                    preferred_location TEXT NOT NULL DEFAULT '',
                    master_school TEXT NOT NULL DEFAULT '',
                    bachelor_school TEXT NOT NULL DEFAULT '',
                    pool_outcome TEXT NOT NULL,
                    pool_evidence TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(platform, platform_candidate_id)
                );
                CREATE TABLE IF NOT EXISTS career_evidence (
                    id INTEGER PRIMARY KEY,
                    candidate_id INTEGER NOT NULL REFERENCES candidate(id),
                    company TEXT NOT NULL DEFAULT '',
                    role TEXT NOT NULL DEFAULT '',
                    period TEXT NOT NULL DEFAULT '',
                    location TEXT NOT NULL DEFAULT '',
                    education_level TEXT NOT NULL DEFAULT '',
                    school TEXT NOT NULL DEFAULT '',
                    source_field TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS candidate_source (
                    id INTEGER PRIMARY KEY,
                    candidate_id INTEGER NOT NULL REFERENCES candidate(id),
                    platform TEXT NOT NULL,
                    scanned_at TEXT NOT NULL,
                    page_type TEXT NOT NULL,
                    source_description TEXT NOT NULL,
                    field_missing TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS detail_queue (
                    id INTEGER PRIMARY KEY,
                    candidate_id INTEGER NOT NULL REFERENCES candidate(id),
                    queue_kind TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    paused_reason TEXT NOT NULL DEFAULT '',
                    UNIQUE(candidate_id, queue_kind)
                );
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _find_candidate_id(
        self, connection: sqlite3.Connection, capture: CandidateCapture
    ) -> int | None:
        if not capture.platform_candidate_id:
            return None
        row = connection.execute(
            "SELECT id FROM candidate WHERE platform = ? AND platform_candidate_id = ?",
            (capture.platform, capture.platform_candidate_id),
        ).fetchone()
        return int(row["id"]) if row else None

    def _insert_evidence(
        self, connection: sqlite3.Connection, candidate_id: int, capture: CandidateCapture
    ) -> None:
        records: Iterable[tuple[object, ...]] = (
            (
                candidate_id,
                item.company,
                item.role,
                item.period,
                item.location,
                item.education_level,
                item.school,
                item.source_field,
            )
            for item in capture.career_evidence
        )
        connection.executemany(
            """
            INSERT INTO career_evidence (
                candidate_id, company, role, period, location, education_level, school, source_field
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            records,
        )
