"""Глобальные веса групп (сущностей). Сумма должна быть 1.0.

Итоговая доля сценария = GROUP_WEIGHTS[group] * MIX[ключ] (MIX в файле ручки суммируется в 1.0).

Вес 0.0 — группа отключена (модули сценариев для неё не участвуют). По умолчанию observability_5xx = 0:
сценарий GET /__loadtest/http500 требует LOADTEST_HTTP_500=true на API; включи, например:
  "user": 0.9, "observability_5xx": 0.1
"""

from __future__ import annotations

GROUP_WEIGHTS: dict[str, float] = {
    "user": 1.0,
    "observability_5xx": 0.0,
    # Пример включения 5xx для метрик: "user": 0.9, "observability_5xx": 0.1 и LOADTEST_HTTP_500=true
}
