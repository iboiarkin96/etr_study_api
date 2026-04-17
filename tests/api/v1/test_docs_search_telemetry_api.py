"""HTTP tests for docs-search telemetry ingest and metrics endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.database import SessionLocal


def _clean_docs_search_events() -> None:
    """Delete all telemetry rows for deterministic endpoint assertions."""
    with SessionLocal() as session:
        session.execute(text("DELETE FROM docs_search_events"))
        session.commit()


def test_ingest_docs_search_telemetry_accepts_valid_payload(client: TestClient) -> None:
    """POST ingest endpoint returns 202 for valid telemetry payload."""
    _clean_docs_search_events()
    response = client.post(
        "/internal/telemetry/docs-search",
        json={
            "event": "search_query",
            "emitted_at_ms": 1_776_420_000_000,
            "page_path": "/index.html",
            "session_id": "s-api",
            "query_id": "q-api",
            "query_text": "adr",
            "query_len": 3,
            "tokens_count": 1,
            "results_count": 4,
            "latency_ms": 8,
            "top_results": [{"rank": 1, "url": "adr/README.html"}],
        },
    )
    assert response.status_code == 202
    assert response.json() == {"status": "accepted"}


def test_ingest_docs_search_telemetry_returns_422_for_invalid_payload(client: TestClient) -> None:
    """POST ingest endpoint returns 422 for malformed payload."""
    response = client.post(
        "/internal/telemetry/docs-search",
        json={
            "emitted_at_ms": 1_776_420_000_000,
        },
    )
    assert response.status_code == 422
    payload = response.json()
    assert payload["error_type"] == "validation_error"
    assert payload["endpoint"] == "POST /internal/telemetry/docs-search"


def test_docs_search_telemetry_metrics_reports_query_counts(client: TestClient) -> None:
    """Metrics endpoint aggregates query rows and click-through data."""
    _clean_docs_search_events()
    client.post(
        "/internal/telemetry/docs-search",
        json={
            "event": "search_query",
            "emitted_at_ms": 1_776_420_010_000,
            "session_id": "s-metrics",
            "query_id": "q-metrics-1",
            "query_text": "adr",
            "query_len": 3,
            "results_count": 0,
        },
    )
    client.post(
        "/internal/telemetry/docs-search",
        json={
            "event": "search_query",
            "emitted_at_ms": 1_776_420_020_000,
            "session_id": "s-metrics",
            "query_id": "q-metrics-2",
            "query_text": "runbook",
            "query_len": 7,
            "results_count": 2,
        },
    )
    client.post(
        "/internal/telemetry/docs-search",
        json={
            "event": "search_result_click",
            "emitted_at_ms": 1_776_420_021_000,
            "session_id": "s-metrics",
            "query_id": "q-metrics-2",
            "result_rank": 1,
            "result_url": "runbooks/README.html",
        },
    )
    response = client.get("/internal/telemetry/docs-search/metrics?window_minutes=100000")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_queries"] == 2
    assert payload["zero_result_queries"] == 1
    assert payload["queries_with_click"] == 1
