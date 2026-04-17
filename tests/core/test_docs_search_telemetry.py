"""Unit tests for docs-search telemetry SQLite store."""

from __future__ import annotations

from pathlib import Path

from app.core.docs_search_telemetry import DocsSearchTelemetryStore


def test_store_insert_and_metrics_computation(tmp_path: Path) -> None:
    """Store inserts events and computes KPI aggregates for a time window."""
    db_path = tmp_path / "telemetry.sqlite3"
    store = DocsSearchTelemetryStore(str(db_path))

    base_ms = 1_776_420_000_000
    store.insert_event(
        {
            "event": "search_query",
            "emitted_at_ms": base_ms,
            "session_id": "s1",
            "query_id": "q1",
            "results_count": 0,
            "top_results": [{"rank": 1, "url": "adr/README.html"}],
        }
    )
    store.insert_event(
        {
            "event": "search_query",
            "emitted_at_ms": base_ms + 1_000,
            "session_id": "s2",
            "query_id": "q2",
            "results_count": 3,
        }
    )
    store.insert_event(
        {
            "event": "search_result_click",
            "emitted_at_ms": base_ms + 2_000,
            "session_id": "s2",
            "query_id": "q2",
            "result_rank": 1,
            "result_url": "adr/0001-docs-as-code.html",
        }
    )
    store.insert_event(
        {
            "event": "search_success",
            "emitted_at_ms": base_ms + 3_000,
            "session_id": "s2",
            "query_id": "q2",
            "time_to_success_ms": 900,
        }
    )

    metrics = store.metrics(now_ms=base_ms + 10_000, window_minutes=10)
    assert metrics.total_queries == 2
    assert metrics.zero_result_queries == 1
    assert metrics.zero_result_rate == 0.5
    assert metrics.queries_with_click == 1
    assert metrics.query_ctr == 0.5
    assert metrics.median_time_to_first_success_ms == 900
    assert metrics.p75_time_to_first_success_ms == 900


def test_store_metrics_returns_none_percentiles_for_empty_successes(tmp_path: Path) -> None:
    """Percentiles are None when there are no valid success samples."""
    db_path = tmp_path / "telemetry-empty.sqlite3"
    store = DocsSearchTelemetryStore(str(db_path))
    base_ms = 1_776_420_000_000
    store.insert_event(
        {
            "event": "search_query",
            "emitted_at_ms": base_ms,
            "session_id": "s1",
            "query_id": "q1",
            "results_count": 2,
        }
    )
    store.insert_event(
        {
            "event": "search_success",
            "emitted_at_ms": base_ms + 100,
            "session_id": "s1",
            "query_id": "q1",
            "time_to_success_ms": 0,
        }
    )

    metrics = store.metrics(now_ms=base_ms + 5_000, window_minutes=5)
    assert metrics.total_queries == 1
    assert metrics.zero_result_rate == 0.0
    assert metrics.median_time_to_first_success_ms is None
    assert metrics.p75_time_to_first_success_ms is None
