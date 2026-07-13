"""Pytest fixtures for API tests.

Boots a session-scoped PostgreSQL container (testcontainers-python), sets
``DATABASE_URL`` before importing app modules, and provisions the schema and
reference data once per session. Per-test cleanup uses ``TRUNCATE ... RESTART
IDENTITY CASCADE`` — an order of magnitude cheaper than DELETE for typical
suites, and it resets serial sequences so assertions on ``id`` stay stable.

Per ADR 0037 (PostgreSQL as runtime database, containerized).
"""

from __future__ import annotations

import os
import sys
from collections.abc import Iterator
from pathlib import Path

# Make the repo root importable so `from tests.api.v1.user_test_utils` resolves.
# pytest's `pythonpath = ["services/api"]` only adds the API root; the tests/
# helpers module lives under the repo root.
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

import pytest
from testcontainers.postgres import PostgresContainer

# Session-scoped container: one boot per pytest invocation. Started here (module
# import time) so `DATABASE_URL` is set before `app.core.config.get_settings`
# validates it. The teardown runs at process exit via `atexit` because the
# module-level singleton has no session-scoped fixture yet.
_POSTGRES = PostgresContainer("postgres:16-alpine", driver="psycopg")
_POSTGRES.start()
os.environ["DATABASE_URL"] = _POSTGRES.get_connection_url()

import atexit

atexit.register(_POSTGRES.stop)

os.environ.setdefault("APP_NAME", "ETR Study App API (tests)")
os.environ["APP_ENV"] = "qa"
os.environ.setdefault("APP_HOST", "127.0.0.1")
os.environ.setdefault("APP_PORT", "8001")
os.environ.setdefault("API_AUTH_STRATEGY", "mock_api_key")
os.environ.setdefault("API_AUTH_HEADER", "X-API-Key")
os.environ.setdefault("API_MOCK_API_KEY", "test-api-key")
os.environ.setdefault("API_RATE_LIMIT_REQUESTS", "100")
os.environ.setdefault("API_RATE_LIMIT_WINDOW_SECONDS", "60")
os.environ.setdefault("API_BODY_MAX_BYTES", "1048576")

from app.core.database import SessionLocal, engine
from app.main import app
from app.models import Base
from fastapi.testclient import TestClient
from sqlalchemy import text

from tests.api.v1.user_test_utils import (
    TEST_INVALIDATION_REASON_UUID,
    TEST_SYSTEM_UUID,
    TEST_SYSTEM_UUID_ALT,
)

# Tables to truncate before each test. Order does not matter because CASCADE
# takes care of FKs; keeping schedule_policies out so its seed row survives.
_PER_TEST_TABLES = (
    "idempotency_keys",
    "learning_errors",
    "conspectus_review_logs",
    "conspectus_events",
    "conspectus_schedules",
    "conspectuses",
    "users",
)


def _seed_reference_data() -> None:
    """Insert minimal ``timezones``, ``systems``, ``invalidation_reasons``, and ``schedule_policies`` for FKs.

    Replaces existing rows so tests start from a known reference set.
    """
    with SessionLocal() as session:
        session.execute(text("DELETE FROM timezones"))
        session.execute(text("DELETE FROM systems"))
        session.execute(text("DELETE FROM invalidation_reasons"))
        session.execute(text("DELETE FROM schedule_policies"))
        session.execute(
            text(
                "INSERT INTO systems (system_uuid, code, name) VALUES "
                "(:uuid, 'test-system', 'Test system')"
            ),
            {"uuid": TEST_SYSTEM_UUID},
        )
        session.execute(
            text(
                "INSERT INTO systems (system_uuid, code, name) VALUES "
                "(:uuid, 'test-system-alt', 'Test system alt')"
            ),
            {"uuid": TEST_SYSTEM_UUID_ALT},
        )
        session.execute(
            text(
                "INSERT INTO invalidation_reasons "
                "(invalidation_reason_uuid, code, description) VALUES "
                "(:uuid, 'test-ir', 'Test invalidation')"
            ),
            {"uuid": TEST_INVALIDATION_REASON_UUID},
        )
        session.execute(
            text(
                "INSERT INTO timezones (code, utc_offset) VALUES "
                "('UTC', 0), ('Europe/Moscow', 180), ('America/New_York', -300)"
            )
        )
        session.execute(
            text(
                "INSERT INTO schedule_policies "
                "(schedule_policy_id, version, algorithm_version, description) VALUES "
                "('etr_methodology_four_slot', '1.0.0', 'v1', 'Reference ETR four-slot review policy.')"
            )
        )
        session.commit()


@pytest.fixture(scope="session", autouse=True)
def prepare_database() -> Iterator[None]:
    """Session-scoped: create schema in the testcontainer Postgres, seed reference data, drop on teardown.

    Yields:
        Control after setup; on teardown drops tables (container is stopped by
        the atexit hook registered at module import).
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    _seed_reference_data()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_users_table() -> None:
    """Autouse: TRUNCATE per-test tables to reset state and sequences.

    Uses ``TRUNCATE ... RESTART IDENTITY CASCADE`` in a single statement — one
    round-trip and every serial (``conspectus_events.id`` etc.) resets to 1
    between tests so assertions on generated IDs stay stable.
    """
    with SessionLocal() as session:
        session.execute(text(f"TRUNCATE {', '.join(_PER_TEST_TABLES)} RESTART IDENTITY CASCADE"))
        session.commit()


@pytest.fixture()
def client() -> TestClient:
    """ASGI test client with the same mock API key as ``API_MOCK_API_KEY`` in this module.

    Returns:
        :class:`fastapi.testclient.TestClient` bound to :data:`app.main.app`.
    """
    return TestClient(app, headers={"X-API-Key": "test-api-key"})
