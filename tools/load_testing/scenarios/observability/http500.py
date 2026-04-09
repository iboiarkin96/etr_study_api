"""GET /__loadtest/http500 — только при LOADTEST_HTTP_500=true на сервере."""

from __future__ import annotations

from tools.load_testing.request import BuiltRequest, RunContext

GROUP = "observability_5xx"

SHARE_OF_GROUP = 1.0

MIX: dict[str, float] = {
    "observability.http500": 1.0,
}


def _http500(ctx: RunContext) -> BuiltRequest:
    return BuiltRequest(
        method="GET",
        path="/__loadtest/http500",
        headers={},
        json=None,
        params=None,
        expect_status=500,
    )


SCENARIOS: dict[str, object] = {
    "observability.http500": _http500,
}
