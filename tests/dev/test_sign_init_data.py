"""Round-trip tests for ``tools/dev/sign_init_data.py``.

The CLI must emit an ``initData`` string that ``verify_init_data`` (shipped in
the API) accepts. If either side drifts, the plain-browser dev loop silently
starts issuing 401s at cold open — this test pins the contract.
"""

from __future__ import annotations

import importlib
import io
import sys
from contextlib import redirect_stdout
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_TOOLS_DIR = _REPO_ROOT / "tools" / "dev"
_API_ROOT = _REPO_ROOT / "services" / "api"

# Both paths need to be importable so the CLI resolves at test time exactly
# like it does from the command line.
for path in (str(_API_ROOT), str(_TOOLS_DIR)):
    if path not in sys.path:
        sys.path.insert(0, path)

sign_init_data = importlib.import_module("sign_init_data")
from app.core.telegram_init_data import (  # noqa: E402
    InvalidInitData,
    verify_init_data,
)

_BOT_TOKEN = "1234567890:AAAA-fake-bot-token-for-tests-only"
_MAX_AGE = 24 * 60 * 60


def _run_cli(argv: list[str]) -> tuple[int, str]:
    """Invoke the CLI in-process, return ``(exit_code, stdout)``."""
    buf = io.StringIO()
    with redirect_stdout(buf):
        code = sign_init_data.main(argv)
    return code, buf.getvalue().strip()


def test_signed_output_round_trips_through_verify(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", _BOT_TOKEN)

    code, raw = _run_cli(["--user-id", "42", "--first-name", "Ada", "--username", "ada"])

    assert code == 0
    verified = verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE)
    assert verified.user.id == 42
    assert verified.user.first_name == "Ada"
    assert verified.user.username == "ada"
    assert verified.user.language_code == "en"  # default


def test_optional_fields_survive_the_round_trip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", _BOT_TOKEN)

    code, raw = _run_cli(
        [
            "--user-id",
            "1",
            "--first-name",
            "Grace",
            "--last-name",
            "Hopper",
            "--photo-url",
            "https://t.me/grace.jpg",
            "--language-code",
            "en",
            "--start-param",
            "conspectus_abc123",
            "--query-id",
            "q1",
        ]
    )

    assert code == 0
    verified = verify_init_data(raw, _BOT_TOKEN, max_age_seconds=_MAX_AGE)
    assert verified.user.last_name == "Hopper"
    assert verified.user.photo_url == "https://t.me/grace.jpg"
    assert verified.raw_fields["start_param"] == "conspectus_abc123"
    assert verified.raw_fields["query_id"] == "q1"


def test_wrong_bot_token_is_rejected_by_verifier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", _BOT_TOKEN)

    code, raw = _run_cli(["--user-id", "7", "--first-name", "X"])

    assert code == 0
    with pytest.raises(InvalidInitData, match="signature"):
        verify_init_data(raw, "different-bot-token", max_age_seconds=_MAX_AGE)


def test_env_format_prints_vite_env_line(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", _BOT_TOKEN)

    code, raw = _run_cli(["--user-id", "1", "--first-name", "X", "--format", "env"])

    assert code == 0
    assert raw.startswith("VITE_DEV_INIT_DATA=")
    encoded = raw.removeprefix("VITE_DEV_INIT_DATA=")
    verified = verify_init_data(encoded, _BOT_TOKEN, max_age_seconds=_MAX_AGE)
    assert verified.user.id == 1


def test_missing_bot_token_exits_2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)

    # Redirect stderr too so the test log stays clean.
    buf_out, buf_err = io.StringIO(), io.StringIO()
    with redirect_stdout(buf_out):
        original_stderr = sys.stderr
        sys.stderr = buf_err
        try:
            code = sign_init_data.main(["--user-id", "1", "--first-name", "X"])
        finally:
            sys.stderr = original_stderr

    assert code == 2
    assert "TELEGRAM_BOT_TOKEN" in buf_err.getvalue()
