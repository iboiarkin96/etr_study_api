"""POST создания пользователя — успех (201) и 422 за счёт поломки поля.

Путь и валидное тело не дублируются: `USER_HTTP_BASE_PATH` и `UserCreateRequest` в приложении.
Новые сценарии: добавь ключ в MIX и SCENARIOS (имена ключей глобально уникальны).
"""

from __future__ import annotations

from app.api.v1.user import USER_HTTP_BASE_PATH
from tools.load_testing.request import BuiltRequest, RunContext
from tools.load_testing.user_payload import apply_break_field, base_user_create

GROUP = "user"

# Доля «этого файла» внутри GROUP_WEIGHTS["user"]. Если добавишь user/get.py, поставь здесь
# например 0.85, а в get.py — 0.15 (в сумме по файлам user = 1.0).
SHARE_OF_GROUP = 1.0

# Доли сценариев внутри этого файла (сумма 1.0)
MIX: dict[str, float] = {
    "user.create.ok": 0.65,
    "user.create.validation_timezone": 0.20,
    "user.create.validation_full_name": 0.15,
}


def _post_user(ctx: RunContext, body: dict, expect_status: int) -> BuiltRequest:
    return BuiltRequest(
        method="POST",
        path=USER_HTTP_BASE_PATH,
        headers={
            "Idempotency-Key": f"load-{ctx.seq}-{ctx.nonce}",
            "Content-Type": "application/json",
        },
        json=body,
        params=None,
        expect_status=expect_status,
    )


def _ok(ctx: RunContext) -> BuiltRequest:
    sid = f"load-{ctx.seq}-{ctx.nonce[:12]}"
    body = base_user_create(sid)
    return _post_user(ctx, body, 201)


def _bad_timezone(ctx: RunContext) -> BuiltRequest:
    sid = f"load-badtz-{ctx.seq}-{ctx.nonce[:12]}"
    body = apply_break_field(base_user_create(sid), "timezone")
    return _post_user(ctx, body, 422)


def _bad_full_name(ctx: RunContext) -> BuiltRequest:
    sid = f"load-badfn-{ctx.seq}-{ctx.nonce[:12]}"
    body = apply_break_field(base_user_create(sid), "full_name")
    return _post_user(ctx, body, 422)


SCENARIOS: dict[str, object] = {
    "user.create.ok": _ok,
    "user.create.validation_timezone": _bad_timezone,
    "user.create.validation_full_name": _bad_full_name,
}
