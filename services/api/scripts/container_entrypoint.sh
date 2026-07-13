#!/usr/bin/env sh
# Shared process bootstrap: wait for Postgres, run Alembic, launch Uvicorn.
# Used by the Docker image (WORKDIR /app) and optionally via `make container-start` on the host.
# Intentionally does not invoke Makefile: the image has no venv/.env; Make targets assume dev layout.
# Per ADR 0037, DATABASE_URL is the only DB env var.
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export LOG_DIR="${LOG_DIR:-/tmp/logs}"
mkdir -p "$LOG_DIR" 2>/dev/null || true

if [ -z "${DATABASE_URL:-}" ]; then
  echo "container_entrypoint: DATABASE_URL is not set (ADR 0037)" >&2
  exit 2
fi

# Defensive wait for Postgres in case compose healthcheck did not gate us
# (e.g. running the image via `docker run` outside compose). Skip if pg_isready
# is unavailable — the SQLAlchemy engine will error out on its own.
if command -v pg_isready >/dev/null 2>&1; then
  # Parse host:port out of DATABASE_URL; fall back to 5432 default.
  DB_HOST="$(printf '%s' "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')"
  DB_PORT="$(printf '%s' "$DATABASE_URL" | sed -n 's|.*@[^:/]*:\([0-9]*\).*|\1|p')"
  DB_HOST="${DB_HOST:-postgres}"
  DB_PORT="${DB_PORT:-5432}"
  echo "container_entrypoint: waiting for postgres at ${DB_HOST}:${DB_PORT}..."
  attempts=0
  until pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 30 ]; then
      echo "container_entrypoint: postgres not ready after 30s" >&2
      exit 3
    fi
    sleep 1
  done
  echo "container_entrypoint: postgres ready."
fi

PYTHON_CMD="${PYTHON:-python3}"
"$PYTHON_CMD" -m alembic upgrade head
# --no-access-log: HTTP lines are logged in app.main with request_id; avoids uvicorn.access without correlation.
exec "$PYTHON_CMD" -m uvicorn app.main:app --host "${APP_HOST:-0.0.0.0}" --port "${APP_PORT:-8000}" --no-access-log
