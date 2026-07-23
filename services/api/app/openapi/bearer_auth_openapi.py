"""OpenAPI enrichment: declare `bearerAuth` alongside the existing `X-API-Key`.

The Telegram Mini App flow signs every ``/api/v1/*`` call with a JWT minted at
``POST /api/v1/auth/telegram``. This module declares the ``bearerAuth`` security
scheme globally so Swagger UI's «Authorize» dialog offers it, and marks every
non-anonymous operation as accepting either credential.
"""

from __future__ import annotations

from typing import Any

_ANONYMOUS_PATHS: set[str] = {
    "/live",
    "/ready",
    "/api/v1/auth/telegram",
}


def enrich_openapi_with_bearer_auth(schema: dict[str, Any]) -> None:
    """Mutate ``schema`` so `bearerAuth` sits next to the API-key scheme.

    Every operation whose path is not in :data:`_ANONYMOUS_PATHS` gains a
    ``security`` list containing both ``bearerAuth`` and ``X-API-Key`` — the
    caller may present either. Anonymous operations (``/live``, ``/ready``,
    ``/api/v1/auth/telegram``) get an empty ``security`` list so Swagger's
    lock icon disappears.

    Args:
        schema: OpenAPI document produced by :func:`fastapi.openapi.utils.get_openapi`.
    """
    components = schema.setdefault("components", {})
    security_schemes = components.setdefault("securitySchemes", {})
    security_schemes["bearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": (
            "24 h HS256 JWT minted at `POST /api/v1/auth/telegram` after"
            " verifying Telegram Mini App `initData`. Use as"
            " `Authorization: Bearer <jwt>` on every subsequent call."
        ),
    }
    security_schemes.setdefault(
        "X-API-Key",
        {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": (
                "Legacy internal-tools credential; the Mini App uses the `bearerAuth` scheme above."
            ),
        },
    )

    paths = schema.get("paths")
    if not isinstance(paths, dict):
        return

    dual_security: list[dict[str, list[str]]] = [{"bearerAuth": []}, {"X-API-Key": []}]

    for path, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            if not isinstance(operation, dict):
                continue
            if path in _ANONYMOUS_PATHS:
                operation["security"] = []
                continue
            operation["security"] = list(dual_security)
