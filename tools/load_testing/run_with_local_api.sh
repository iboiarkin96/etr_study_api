#!/usr/bin/env bash
# Запуск API с ослабленным rate limit, ожидание /ready, прогон tools.load_testing.runner, остановка API.
# Вызывается из Makefile: make run-loadtest-api
#
# Переменные (опционально):
#   API_RATE_LIMIT_REQUESTS_LOADTEST (по умолчанию 1000000000), API_RATE_LIMIT_WINDOW_SECONDS_LOADTEST — лимиты API
#   LOADTEST_TOTAL_REQUESTS — число запросов (иначе LOADTEST_DEFAULT_* из .env и env/$APP_ENV, иначе 100)
#   LOADTEST_DELAY_MS — пауза (мс); дефолты — LOADTEST_DEFAULT_* в env/example и env/dev
# Загрузка: .env, затем env/$APP_ENV (как в app.core.config). Export перед make перекрывает файлы.
#   LOADTEST_RUNNER_EXTRA — доп. аргументы раннера (в кавычках), напр. "--seed 42"
#   LOADTEST_SKIP_CONFIRM=1 — не спрашивать подтверждение (CI / скрипты)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "${ENV_FILE} not found. Run: make env-init" >&2
  exit 1
fi
if [[ ! -f .venv/bin/python ]]; then
  echo ".venv/bin/python missing. Run: make venv && make install" >&2
  exit 1
fi

# Явный export перед make перекрывает значения из файлов
# (с set -e нельзя «[[ условие ]] && cmd» — ложное условие даёт exit 1 и рвёт скрипт)
_restore_loadtest_overrides() {
  if [[ "$_lt_preserve_total" -eq 1 ]]; then
    LOADTEST_TOTAL_REQUESTS="$_lt_save_total"
  fi
  if [[ "$_lt_preserve_delay" -eq 1 ]]; then
    LOADTEST_DELAY_MS="$_lt_save_delay"
  fi
  if [[ "$_lt_preserve_def_total" -eq 1 ]]; then
    LOADTEST_DEFAULT_TOTAL_REQUESTS="$_lt_save_def_total"
  fi
  if [[ "$_lt_preserve_def_delay" -eq 1 ]]; then
    LOADTEST_DEFAULT_DELAY_MS="$_lt_save_def_delay"
  fi
}
_lt_preserve_total=0
_lt_preserve_delay=0
_lt_preserve_def_total=0
_lt_preserve_def_delay=0
if [[ -n "${LOADTEST_TOTAL_REQUESTS+x}" ]]; then
  _lt_preserve_total=1
  _lt_save_total="$LOADTEST_TOTAL_REQUESTS"
fi
if [[ -n "${LOADTEST_DELAY_MS+x}" ]]; then
  _lt_preserve_delay=1
  _lt_save_delay="$LOADTEST_DELAY_MS"
fi
if [[ -n "${LOADTEST_DEFAULT_TOTAL_REQUESTS+x}" ]]; then
  _lt_preserve_def_total=1
  _lt_save_def_total="$LOADTEST_DEFAULT_TOTAL_REQUESTS"
fi
if [[ -n "${LOADTEST_DEFAULT_DELAY_MS+x}" ]]; then
  _lt_preserve_def_delay=1
  _lt_save_def_delay="$LOADTEST_DEFAULT_DELAY_MS"
fi

set -a
# shellcheck disable=SC1091
source "./$ENV_FILE"
APP_ENV="${APP_ENV:-dev}"
PROFILE="$ROOT/env/$APP_ENV"
if [[ -f "$PROFILE" ]]; then
  # shellcheck disable=SC1091
  source "$PROFILE"
fi
set +a

_restore_loadtest_overrides

export API_RATE_LIMIT_REQUESTS="${API_RATE_LIMIT_REQUESTS_LOADTEST:-1000000000}"
export API_RATE_LIMIT_WINDOW_SECONDS="${API_RATE_LIMIT_WINDOW_SECONDS_LOADTEST:-60}"

HOST="${APP_HOST:-127.0.0.1}"
PORT="${APP_PORT:-8000}"
CURL_HOST="$HOST"
if [[ "$HOST" == "0.0.0.0" ]]; then
  CURL_HOST="127.0.0.1"
fi

print_warning_and_confirm() {
  echo ""
  echo "Внимание. Прогон run-loadtest-api делает следующее:"
  echo "  • поднимает отдельный процесс uvicorn (повышенный rate limit, без --reload) на http://${CURL_HOST}:${PORT};"
  echo "  • после ответа /ready запускает python -m tools.load_testing.runner;"
  echo "  • по завершении раннера этот процесс API будет остановлен (как «тушение» временного сервера)."
  echo ""
  echo "Если сейчас у вас уже запущен API на этом порту (make run, make run-loadtest-api-serve и т.п.),"
  echo "освободите порт ${PORT} вручную — иначе новый экземпляр не поднимется (адрес уже занят)."
  echo ""
  if [[ "${LOADTEST_SKIP_CONFIRM:-}" == "1" ]]; then
    echo "LOADTEST_SKIP_CONFIRM=1 — подтверждение пропущено."
    return 0
  fi
  local ans
  if [[ -c /dev/tty ]]; then
    read -r -p "Продолжить прогон? [д/н] (y/n): " ans < /dev/tty || true
  elif [[ -t 0 ]]; then
    read -r -p "Продолжить прогон? [д/н] (y/n): " ans || true
  else
    echo "Нет терминала для вопроса да/нет — подтверждение пропущено (в CI задайте LOADTEST_SKIP_CONFIRM=1 явно)."
    return 0
  fi
  case "$ans" in
    y|Y|yes|YES|д|Д|да|Да) return 0 ;;
    *) return 1 ;;
  esac
}

if ! print_warning_and_confirm; then
  echo "Операция отменена."
  exit 0
fi

echo "→ Starting uvicorn (loadtest limits: ${API_RATE_LIMIT_REQUESTS}/${API_RATE_LIMIT_WINDOW_SECONDS}s)…"
.venv/bin/python -m uvicorn app.main:app --host "$HOST" --port "$PORT" &
UV_PID=$!

cleanup() {
  if kill -0 "$UV_PID" 2>/dev/null; then
    echo "→ Stopping API (pid $UV_PID)…"
    kill "$UV_PID" 2>/dev/null || true
    wait "$UV_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "→ Waiting for http://${CURL_HOST}:${PORT}/ready …"
READY_OK=0
for _ in $(seq 1 60); do
  if curl -sf "http://${CURL_HOST}:${PORT}/ready" >/dev/null; then
    READY_OK=1
    break
  fi
  sleep 1
done
if [[ "$READY_OK" -ne 1 ]]; then
  echo "✗ API did not become ready in time." >&2
  exit 1
fi

export LOAD_TEST_BASE_URL="http://${CURL_HOST}:${PORT}"
: "${LOADTEST_DEFAULT_TOTAL_REQUESTS:=100}"
: "${LOADTEST_DEFAULT_DELAY_MS:=0}"
TOTAL="${LOADTEST_TOTAL_REQUESTS:-$LOADTEST_DEFAULT_TOTAL_REQUESTS}"
DELAY="${LOADTEST_DELAY_MS:-$LOADTEST_DEFAULT_DELAY_MS}"

echo "→ Running: python -m tools.load_testing.runner --total-requests ${TOTAL} --delay-ms ${DELAY} ${LOADTEST_RUNNER_EXTRA:-}"
# shellcheck disable=SC2086
set +e
.venv/bin/python -m tools.load_testing.runner --total-requests "$TOTAL" --delay-ms "$DELAY" ${LOADTEST_RUNNER_EXTRA:-}
RC=$?
set -e
exit "$RC"
