"""Mint a signed Telegram Mini App ``initData`` string for the local dev loop.

The API rejects any ``/api/v1/*`` call without a Bearer JWT; the JWT is minted at
``POST /api/v1/auth/telegram`` after HMAC-verifying ``initData`` against the
running ``TELEGRAM_BOT_TOKEN``. In the plain-browser dev loop nothing signs
``initData`` for us, so this tool does — reusing the exact verifier-matched
helper shipped in ``app.core.telegram_init_data`` so the algorithm can only
drift in one place.

Typical usage::

    export TELEGRAM_BOT_TOKEN=1234:AAA...           # same value the API reads
    python tools/dev/sign_init_data.py \\
        --user-id 12345 --first-name Ada --username ada

Prints the URL-encoded ``initData`` query string to stdout. Pipe it into a
file, an env var, or paste it directly into ``mockTelegramEnv()`` in the Vite
scaffold. ``--format env`` prints ``VITE_DEV_INIT_DATA=...`` for direct
sourcing into ``services/telegram/.env.local``.

Reset flow::

    python tools/dev/sign_init_data.py \\
        --user-id 42 --first-name Dev --format env --wipe-all

``--wipe-all`` deletes every learner-owned row for the given Telegram user
before signing (learning_errors → conspectus_review_logs → conspectuses, in
FK order). Use to verify empty-state renders on Today / Errors / Schedule
without spinning up a fresh account. Talks to Postgres via ``DATABASE_URL``.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

# The verifier + signer live under the API app. Add its root to sys.path so a
# plain `python tools/dev/sign_init_data.py` invocation resolves the import
# without a Makefile PYTHONPATH= dance.
_REPO_ROOT = Path(__file__).resolve().parents[2]
_API_ROOT = _REPO_ROOT / "services" / "api"
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

from app.core.telegram_init_data import build_init_data_for_tests  # noqa: E402


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sign_init_data",
        description=(
            "Mint a signed Telegram Mini App initData string for the local dev loop. "
            "Uses the same HMAC path the server's verifier does; the bot token must "
            "match the one the running API reads."
        ),
    )
    parser.add_argument(
        "--bot-token",
        default=os.environ.get("TELEGRAM_BOT_TOKEN", ""),
        help=(
            "Bot token to sign with. Defaults to the TELEGRAM_BOT_TOKEN env var so "
            "you can `export` it once per shell."
        ),
    )
    parser.add_argument(
        "--user-id",
        type=int,
        default=999_000_001,
        help="Telegram numeric user id (int64). Default: 999000001 (a synthetic dev id).",
    )
    parser.add_argument("--first-name", default="Dev User", help="Default: 'Dev User'.")
    parser.add_argument("--last-name", default=None)
    parser.add_argument("--username", default=None)
    parser.add_argument("--photo-url", default=None)
    parser.add_argument("--language-code", default="en", help="BCP-47. Default: 'en'.")
    parser.add_argument(
        "--auth-date",
        type=int,
        default=None,
        help=(
            "Unix seconds. Default: now. Payload is rejected server-side once "
            "auth_date is older than TELEGRAM_INIT_DATA_MAX_AGE_SECONDS (24 h by default)."
        ),
    )
    parser.add_argument(
        "--start-param",
        default=None,
        help="Optional deep-link payload (e.g. 'conspectus_<uuid>').",
    )
    parser.add_argument("--query-id", default=None, help="Optional Telegram query_id.")
    parser.add_argument(
        "--format",
        choices=("url", "env"),
        default="url",
        help=(
            "'url' (default): raw URL-encoded initData string. "
            "'env': `VITE_DEV_INIT_DATA=<string>` line for sourcing into .env.local."
        ),
    )
    parser.add_argument(
        "--wipe-all",
        action="store_true",
        help=(
            "Before signing, wipe every learner-owned row for the target "
            "telegram user: learning_errors, conspectus_review_logs, and "
            "conspectuses (dependent tables cascade). After the wipe every "
            "empty state renders: /errors shows «no misses this week», Today's "
            "MissPeek stays hidden, streak resets, heat-map goes flat, due "
            "list empties. Rerun `seed_dev_data.py --telegram-user-id …` to "
            "repopulate. Talks to Postgres directly via DATABASE_URL (default: "
            "postgresql://study_app:study_app@localhost:5432/study_app)."
        ),
    )
    return parser


def _build_user_dict(args: argparse.Namespace) -> dict[str, object]:
    user: dict[str, object] = {"id": args.user_id, "first_name": args.first_name}
    if args.last_name is not None:
        user["last_name"] = args.last_name
    if args.username is not None:
        user["username"] = args.username
    if args.photo_url is not None:
        user["photo_url"] = args.photo_url
    if args.language_code is not None:
        user["language_code"] = args.language_code
    return user


def _build_extra_fields(args: argparse.Namespace) -> dict[str, str]:
    extras: dict[str, str] = {}
    if args.start_param is not None:
        extras["start_param"] = args.start_param
    if args.query_id is not None:
        extras["query_id"] = args.query_id
    return extras


def _wipe_learner_data(telegram_user_id: int) -> None:
    """Delete every learner-owned row for the given Telegram user, in FK order.

    Uses psycopg directly (already a project dep) rather than SQLAlchemy so
    this script stays close to stdlib. Order: learning_errors →
    conspectus_review_logs → conspectuses. Each DELETE is scoped by
    ``owner_client_uuid`` resolved from ``telegram_users``. If the telegram
    user row doesn't exist yet, nothing to wipe — the message is printed and
    the function returns without erroring.
    """
    try:
        import psycopg
    except ImportError:  # pragma: no cover — dev-only path
        print(
            "error: psycopg not installed. Install it in your venv or run "
            "from services/api's .venv (make -C services/api setup).",
            file=sys.stderr,
        )
        raise SystemExit(2) from None

    # DATABASE_URL uses the SQLAlchemy `postgresql+psycopg://` scheme in
    # env/dev; psycopg's own connector wants plain `postgresql://`. Strip the
    # dialect prefix if present so the same env var works for both callers.
    dsn = os.environ.get(
        "DATABASE_URL",
        "postgresql://study_app:study_app@localhost:5432/study_app",
    ).replace("postgresql+psycopg://", "postgresql://", 1)

    with psycopg.connect(dsn, autocommit=False) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT client_uuid FROM telegram_users WHERE telegram_user_id = %s",
            (telegram_user_id,),
        )
        row = cur.fetchone()
        if row is None:
            print(
                f"[wipe] no telegram_users row for telegram_user_id={telegram_user_id} "
                "— nothing to wipe (user will be created on first successful login)."
            )
            return
        owner = row[0]

        cur.execute("DELETE FROM learning_errors WHERE owner_client_uuid = %s", (owner,))
        errors_deleted = cur.rowcount
        cur.execute(
            "DELETE FROM conspectus_review_logs "
            "WHERE conspectus_uuid IN "
            "(SELECT conspectus_uuid FROM conspectuses WHERE owner_client_uuid = %s)",
            (owner,),
        )
        reviews_deleted = cur.rowcount
        cur.execute("DELETE FROM conspectuses WHERE owner_client_uuid = %s", (owner,))
        conspectuses_deleted = cur.rowcount
        conn.commit()

    print(
        f"[wipe] owner={owner} · "
        f"learning_errors={errors_deleted} · "
        f"conspectus_review_logs={reviews_deleted} · "
        f"conspectuses={conspectuses_deleted}",
        file=sys.stderr,
    )


def main(argv: list[str] | None = None) -> int:
    """Parse CLI args, sign one ``initData``, print it to stdout.

    Args:
        argv: Optional argument list (defaults to ``sys.argv[1:]``).

    Returns:
        ``0`` on success, ``2`` when ``--bot-token`` / ``TELEGRAM_BOT_TOKEN`` is missing.
    """
    args = _build_parser().parse_args(argv)
    if not args.bot_token:
        print(
            "error: no bot token — set TELEGRAM_BOT_TOKEN or pass --bot-token.\n"
            "The token must match the value the running API reads; see env/example.",
            file=sys.stderr,
        )
        return 2

    if args.wipe_all:
        _wipe_learner_data(args.user_id)

    auth_date = args.auth_date if args.auth_date is not None else int(time.time())
    encoded = build_init_data_for_tests(
        bot_token=args.bot_token,
        user=_build_user_dict(args),
        auth_date=auth_date,
        extra_fields=_build_extra_fields(args),
    )

    if args.format == "env":
        print(f"VITE_DEV_INIT_DATA={encoded}")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    sys.exit(main())
