#!/usr/bin/env python3
"""Draft Keep a Changelog bullets from git history (optional OpenAI-compatible API).

Assistive only: prints markdown to stdout; humans merge into CHANGELOG.md.
See docs/adr/0013-changelog-and-release-notes.html.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from typing import Any


def _git(*args: str) -> str:
    out = subprocess.run(
        ["git", *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return out.stdout


def _build_prompt(since: str, head: str) -> tuple[str, str]:
    log = _git("log", f"{since}..{head}", "--oneline", "--no-decorate")
    stat = _git("diff", "--stat", since, head)
    system = (
        "You help maintain a Keep a Changelog style entry under [Unreleased]. "
        "Reply with markdown bullet lists only (### Added / Changed / Fixed as needed). "
        "Be concise; describe user-visible or API-relevant changes; skip pure churn."
    )
    user = f"Git log ({since}..{head}):\n\n{log}\n\nDiff stat:\n\n{stat}\n"
    return system, user


def _openai_compatible_chat(
    *,
    base_url: str,
    api_key: str,
    model: str,
    system: str,
    user: str,
) -> str:
    import httpx

    url = base_url.rstrip("/") + "/chat/completions"
    payload: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.3,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected API response: {json.dumps(data)[:500]}") from e


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--since",
        default="main",
        metavar="REF",
        help="Start ref for git log / diff (default: main)",
    )
    parser.add_argument(
        "--head",
        default="HEAD",
        metavar="REF",
        help="End ref (default: HEAD)",
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("OPENAI_MODEL") or "gpt-4o-mini",
        help="Model id (default: env OPENAI_MODEL or gpt-4o-mini)",
    )
    parser.add_argument(
        "--print-log",
        action="store_true",
        help="Print git log/stat only (no API call)",
    )
    args = parser.parse_args()

    system, user = _build_prompt(args.since, args.head)
    if args.print_log:
        print(user)
        return 0

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print(
            "Set OPENAI_API_KEY for LLM draft, or use --print-log to see git input only.",
            file=sys.stderr,
        )
        return 1

    base_url = (os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip()
    try:
        text = _openai_compatible_chat(
            base_url=base_url,
            api_key=api_key,
            model=args.model,
            system=system,
            user=user,
        )
    except Exception as e:
        print(f"changelog_draft: {e}", file=sys.stderr)
        return 1

    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
