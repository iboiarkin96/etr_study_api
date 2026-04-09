"""GET /api/v1/user/{system_user_id} — только если заданы реальные id в БД.

Если ROTATE_SYSTEM_USER_IDS пуст, модуль не участвует в нагрузке (MIX пустой).
"""

from __future__ import annotations

from app.api.v1.user import USER_HTTP_BASE_PATH
from tools.load_testing.request import BuiltRequest, RunContext

GROUP = "user"

# Доля этого файла в GROUP_WEIGHTS["user"] (вместе с create.py должно давать 1.0).
SHARE_OF_GROUP = 0.15

# Подставь сюда system_user_id существующих пользователей (из своей БД).
ROTATE_SYSTEM_USER_IDS: list[str] = []


def _get_user(ctx: RunContext) -> BuiltRequest:
    if not ROTATE_SYSTEM_USER_IDS:
        raise RuntimeError("ROTATE_SYSTEM_USER_IDS пуст — заполни tools/.../user/get.py")
    sid = ROTATE_SYSTEM_USER_IDS[ctx.run_in_scenario % len(ROTATE_SYSTEM_USER_IDS)]
    return BuiltRequest(
        method="GET",
        path=f"{USER_HTTP_BASE_PATH}/{sid}",
        headers={},
        json=None,
        params=None,
        expect_status=200,
    )


if ROTATE_SYSTEM_USER_IDS:
    MIX: dict[str, float] = {
        "user.get.ok": 1.0,
    }
    SCENARIOS: dict[str, object] = {
        "user.get.ok": _get_user,
    }
else:
    # Не участвуем в нагрузке; SHARE_OF_GROUP у create.py остаётся 1.0
    SHARE_OF_GROUP = 0.0
    MIX = {}
    SCENARIOS = {}
