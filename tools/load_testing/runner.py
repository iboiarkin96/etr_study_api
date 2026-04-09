"""
Нагрузочный раннер: собирает сценарии из tools/load_testing/scenarios/**/*.py.

  python -m tools.load_testing.runner --dry-run
  python -m tools.load_testing.runner --total-requests 200

Переменные окружения (опционально):
  LOAD_TEST_BASE_URL   (по умолчанию http://127.0.0.1:8000)
  LOAD_TEST_API_KEY    (по умолчанию local-dev-key)
  LOAD_TEST_VERBOSE=1  — печатать пропуск сценариев с нулевым весом группы (как --verbose)

Документация: tools/load_testing/README.html
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import random
import sys
import time
import uuid
from collections import Counter
from collections.abc import Callable, Iterator
from pathlib import Path

import httpx

from tools.load_testing.request import BuiltRequest, RunContext

SCENARIO_BUILD = Callable[[RunContext], BuiltRequest]
DELAY_MS = 10


def _scenario_modules() -> Iterator[str]:
    root = Path(__file__).resolve().parent / "scenarios"
    for path in sorted(root.rglob("*.py")):
        if path.name == "__init__.py" or path.name == "weights.py" or path.name.startswith("_"):
            continue
        rel = path.relative_to(root).with_suffix("")
        yield "tools.load_testing.scenarios." + ".".join(rel.parts)


def _load_module(name: str):
    return importlib.import_module(name)


def _abs_sum(weights: dict[str, float]) -> float:
    return sum(weights.values())


def collect(
    *, verbose: bool = False
) -> tuple[
    dict[str, float],
    dict[str, SCENARIO_BUILD],
    dict[str, str],
]:
    """Итоговые веса сценария, билдеры, модуль-источник (для ошибок).

    verbose: выводить в stderr строки о пропуске модулей с GROUP_WEIGHTS[group]==0.
    """
    wmod = _load_module("tools.load_testing.scenarios.weights")
    group_weights: dict[str, float] = dict(wmod.GROUP_WEIGHTS)

    if abs(_abs_sum(group_weights) - 1.0) > 0.02:
        raise SystemExit(
            f"GROUP_WEIGHTS должны суммироваться в ~1.0, сейчас {_abs_sum(group_weights)}"
        )

    final: dict[str, float] = {}
    builders: dict[str, SCENARIO_BUILD] = {}
    sources: dict[str, str] = {}
    share_by_group: dict[str, list[tuple[str, float]]] = {}

    for mod_name in _scenario_modules():
        mod = _load_module(mod_name)
        mix = getattr(mod, "MIX", None)
        scenarios = getattr(mod, "SCENARIOS", None)
        if not mix or not scenarios:
            continue
        if abs(_abs_sum(mix) - 1.0) > 0.02:
            raise SystemExit(f"{mod_name}: MIX должен суммироваться в ~1.0, сейчас {_abs_sum(mix)}")

        group = getattr(mod, "GROUP", None)
        if not group or group not in group_weights:
            raise SystemExit(f"{mod_name}: задай GROUP из GROUP_WEIGHTS: {sorted(group_weights)}")

        gw = float(group_weights[group])
        if gw <= 0.0:
            if verbose:
                print(
                    f"Пропуск {mod_name}: вес группы {group!r} в GROUP_WEIGHTS равен 0 (сценарии отключены).",
                    file=sys.stderr,
                )
            continue

        share = float(getattr(mod, "SHARE_OF_GROUP", 1.0))
        share_by_group.setdefault(group, []).append((mod_name, share))
        for key, frac in mix.items():
            if key in final:
                raise SystemExit(
                    f"Дублируется ключ сценария {key!r} ({mod_name} и {sources.get(key)})"
                )
            if key not in scenarios:
                raise SystemExit(f"{mod_name}: ключ {key!r} есть в MIX, нет в SCENARIOS")
            fn = scenarios[key]
            if not callable(fn):
                raise SystemExit(f"{mod_name}: SCENARIOS[{key!r}] должен быть callable")
            w = gw * share * float(frac)
            final[key] = w
            builders[key] = fn  # type: ignore[assignment]
            sources[key] = mod_name

    for group, shares in share_by_group.items():
        s = sum(sh for _, sh in shares)
        if abs(s - 1.0) > 0.02:
            raise SystemExit(
                f"Группа {group!r}: сумма SHARE_OF_GROUP по файлам должна быть ~1.0, сейчас {s}. "
                f"Файлы: {shares}"
            )

    if abs(_abs_sum(final) - 1.0) > 0.02:
        raise SystemExit(
            f"Итоговые веса сценариев должны суммироваться в ~1.0, сейчас {_abs_sum(final)}"
        )

    return final, builders, sources


def split_counts(total: int, weights: dict[str, float]) -> dict[str, int]:
    if total < 1:
        raise ValueError("total_requests >= 1")
    keys = list(weights.keys())
    raw = [total * weights[k] for k in keys]
    counts = [int(x) for x in raw]
    rest = total - sum(counts)
    frac = sorted(
        enumerate([raw[i] - counts[i] for i in range(len(keys))]), key=lambda t: t[1], reverse=True
    )
    for i in range(rest):
        counts[frac[i][0]] += 1
    return dict(zip(keys, counts, strict=True))


def join_url(base: str, path: str) -> str:
    return base.rstrip("/") + "/" + path.lstrip("/")


def _mask_api_key(value: str) -> str:
    if len(value) <= 4:
        return "***"
    return f"***{value[-4:]}"


def format_request_for_log(
    *,
    method: str,
    url: str,
    headers: dict[str, str],
    json_body: object | None,
    params: dict[str, str] | None,
) -> str:
    """Текст для stderr: полный запрос (X-API-Key частично маскируется)."""
    lines: list[str] = [f"{method} {url}"]
    if params:
        lines.append(f"query_string: {params!r}")
    lines.append("headers:")
    for hk in sorted(headers.keys(), key=str.lower):
        val = headers[hk]
        if hk.lower() == "x-api-key":
            val = _mask_api_key(val)
        lines.append(f"  {hk}: {val}")
    if json_body is not None:
        lines.append("body (JSON):")
        lines.append(json.dumps(json_body, ensure_ascii=False, indent=2))
    else:
        lines.append("body: <none>")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Нагрузка по сценариям из tools/load_testing/scenarios/"
    )
    p.add_argument("--total-requests", type=int, default=100)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--delay-ms",
        type=float,
        default=None,
        help="Пауза между запросами (мс). По умолчанию из LOAD_TEST_DELAY_MS или ~1 с — иначе при лимите "
        "~60 запросов / 60 с на клиента часто получите 429. Для стресс-теста без паузы: --delay-ms 0.",
    )
    p.add_argument("--seed", type=int, default=None, help="Seed для воспроизводимого перемешивания")
    p.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Показывать пропуск модулей с нулевым весом группы (или LOAD_TEST_VERBOSE=1).",
    )
    p.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Не выводить прогресс в stdout во время прогона (итог в конце всё равно печатается).",
    )
    args = p.parse_args(argv)

    base_url = os.environ.get("LOAD_TEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
    api_key = os.environ.get("LOAD_TEST_API_KEY", "local-dev-key")

    if args.delay_ms is None:
        raw = os.environ.get("LOAD_TEST_DELAY_MS", "").strip()
        args.delay_ms = float(raw) if raw else DELAY_MS

    verbose = args.verbose or os.environ.get("LOAD_TEST_VERBOSE", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    weights, builders, _sources = collect(verbose=verbose)
    if args.seed is not None:
        random.seed(args.seed)

    counts = split_counts(args.total_requests, weights)
    plan: list[str] = []
    for name, n in counts.items():
        plan.extend([name] * n)
    random.shuffle(plan)

    if args.dry_run:
        print(f"base_url={base_url}")
        print(f"total_requests={args.total_requests}")
        print(f"по сценариям (шт.): {counts}")
        print(f"слотов в плане: {len(plan)}")
        return 0

    default_headers = {
        "X-API-Key": api_key,
        "Accept": "application/json",
    }
    delay = max(0.0, float(args.delay_ms) / 1000.0)
    stats: Counter[int] = Counter()
    wrong = 0
    run_in_scenario: dict[str, int] = {k: 0 for k in counts}

    total = args.total_requests
    progress_every = max(1, min(50, total // 20))
    if not args.quiet:
        print(
            f"Старт: {total} запросов → {base_url}, пауза {float(args.delay_ms):g} мс между запросами",
            flush=True,
        )

    with httpx.Client(timeout=60.0) as client:
        for seq, key in enumerate(plan):
            ri = run_in_scenario[key]
            run_in_scenario[key] = ri + 1

            nonce = uuid.uuid4().hex
            ctx = RunContext(seq=seq, run_in_scenario=ri, nonce=nonce)
            built: BuiltRequest = builders[key](ctx)

            hdrs = {**default_headers, **built.headers}
            url = join_url(base_url, built.path)

            try:
                if built.method == "GET":
                    r = client.get(url, headers=hdrs, params=built.params)
                elif built.method == "POST":
                    r = client.post(url, headers=hdrs, json=built.json, params=built.params)
                else:
                    raise RuntimeError(f"Неподдерживаемый method {built.method}")
            except httpx.HTTPError as e:
                print(f"[{seq + 1}/{args.total_requests}] {key}: сеть: {e}", file=sys.stderr)
                stats[-1] += 1
                continue

            stats[r.status_code] += 1
            if r.status_code != built.expect_status:
                wrong += 1
                hint = ""
                if (
                    built.expect_status == 500
                    and r.status_code == 404
                    and "/__loadtest/http500" in url
                ):
                    hint = " (нужен LOADTEST_HTTP_500=true на сервере)"
                print(
                    f"[{seq + 1}/{args.total_requests}] {key}: ожидали HTTP {built.expect_status}, "
                    f"получили {r.status_code}{hint}",
                    file=sys.stderr,
                )
                if r.status_code == 429:
                    print(
                        format_request_for_log(
                            method=built.method,
                            url=url,
                            headers=hdrs,
                            json_body=built.json,
                            params=built.params,
                        ),
                        file=sys.stderr,
                    )
                    try:
                        detail = r.json()
                    except Exception:
                        detail = r.text
                    print(f"ответ сервера (429): {detail!r}", file=sys.stderr)
                    print("---", file=sys.stderr)

            if not args.quiet:
                done = seq + 1
                if done in (1, total) or (total > 1 and done % progress_every == 0):
                    print(f"[{done}/{total}] {key} → HTTP {r.status_code}", flush=True)

            if delay:
                time.sleep(delay)

    print("---")
    print(f"Готово, запросов: {args.total_requests}")
    net_errors = int(stats.get(-1, 0))
    if net_errors:
        # -1 зарезервирован в Counter для сбоев до HTTP-ответа (см. except ниже по циклу).
        stats_for_print = Counter(stats)
        del stats_for_print[-1]
        print(f"HTTP статусы: {dict(sorted(stats_for_print.items()))}")
        print(f"Сетевые сбои (нет ответа HTTP): {net_errors}", file=sys.stderr)
    else:
        print(f"HTTP статусы: {dict(sorted(stats.items()))}")

    if wrong:
        print(f"Несовпадений с expect_status: {wrong}", file=sys.stderr)
        if stats.get(429, 0) > 0:
            print(
                "Подсказка: ответы 429 — rate limit API (~60 запросов за окно на клиента по умолчанию). "
                "Варианты: увеличь --delay-ms; для локальной нагрузки запусти API через «make run-loadtest-api» "
                "(см. Makefile) или подними API_RATE_LIMIT_REQUESTS в .env только на время прогона.",
                file=sys.stderr,
            )
        return 2
    if net_errors:
        print(
            "Подсказка: «Connection refused» / сетевые ошибки — на base_url никто не слушает или процесс API "
            "уже остановился/упал до конца прогона. Проверь, что сервер запущен на LOAD_TEST_BASE_URL, "
            "логи uvicorn и что порт свободен; при длинном прогоне смотри, не завершился ли отдельный терминал с API.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
