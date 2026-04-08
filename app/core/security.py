"""Security helpers for API defaults (auth, limits, headers)."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import Request
from starlette.responses import JSONResponse, Response

from app.core.config import Settings


def build_security_error_payload(code: str, key: str, message: str) -> dict[str, str]:
    """Build stable machine-readable payload for security failures."""
    return {
        "code": code,
        "key": key,
        "message": message,
        "source": "security",
    }


@dataclass(frozen=True)
class RateLimitResult:
    """Rate-limit decision with metadata for response headers."""

    allowed: bool
    remaining: int
    retry_after_seconds: int


class InMemoryRateLimiter:
    """Simple process-local fixed-window limiter."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self._limit = limit
        self._window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, bucket: str) -> RateLimitResult:
        """Evaluate whether request in bucket can continue."""
        now = monotonic()
        window_start = now - self._window_seconds
        with self._lock:
            events = self._hits[bucket]
            while events and events[0] <= window_start:
                events.popleft()

            if len(events) >= self._limit:
                retry_after = max(1, int(self._window_seconds - (now - events[0])))
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    retry_after_seconds=retry_after,
                )

            events.append(now)
            remaining = max(0, self._limit - len(events))
            return RateLimitResult(
                allowed=True,
                remaining=remaining,
                retry_after_seconds=0,
            )


def apply_security_headers(response: Response, request_path: str) -> None:
    """Attach common hardening headers to every response."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request_path.startswith("/docs") or request_path.startswith("/redoc"):
        # Swagger/ReDoc load assets from jsdelivr; keep policy strict but compatible.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "base-uri 'none'; "
            "frame-ancestors 'none'; "
            "form-action 'none'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "font-src 'self' data: https://cdn.jsdelivr.net; "
            "connect-src 'self'"
        )
        return

    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )


def extract_client_id(request: Request) -> str:
    """Resolve client id from proxy-aware headers or socket address."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown-client"


def is_protected_api_request(request: Request, settings: Settings) -> bool:
    """Return True when request should pass auth/rate-limit checks."""
    if request.method.upper() == "OPTIONS":
        return False
    return request.url.path.startswith(settings.api_protected_prefix)


def authenticate_request(request: Request, settings: Settings) -> JSONResponse | None:
    """Apply basic auth strategy and return error response when unauthorized."""
    strategy = settings.api_auth_strategy.strip().lower()
    if strategy in {"disabled", "none", "off"}:
        return None

    if strategy == "mock_api_key":
        provided_key = request.headers.get(settings.api_auth_header)
        if provided_key == settings.api_mock_api_key:
            return None
        return JSONResponse(
            status_code=401,
            content={
                "detail": build_security_error_payload(
                    code="COMMON_401",
                    key="SECURITY_AUTH_REQUIRED",
                    message=(f"Missing or invalid API key in header `{settings.api_auth_header}`."),
                )
            },
        )

    return JSONResponse(
        status_code=500,
        content={
            "detail": build_security_error_payload(
                code="COMMON_500",
                key="SECURITY_AUTH_STRATEGY_INVALID",
                message=f"Unsupported auth strategy: `{settings.api_auth_strategy}`.",
            )
        },
    )
