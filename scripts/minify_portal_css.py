#!/usr/bin/env python3
"""Minify portal CSS assets in place.

Strips comments and collapses whitespace in every CSS file under
``services/frontend/portal/assets/``. Preserves:

  * String literals (``"..."``, ``'...'``).
  * Whitespace inside parentheses, so ``calc(100% + 10px)`` and
    ``calc(var(--x) - var(--y))`` survive intact.
  * License/legal comments shaped as ``/*! ... */``.

What gets removed:

  * Block comments (other than ``/*! ... */``).
  * Whitespace around ``{ } ; , : > ~``.
  * Whitespace immediately after ``(`` and before ``)``.
  * The trailing ``;`` before ``}``.

``+`` and ``-`` whitespace is intentionally preserved at top level: stripping
around ``-`` breaks multi-value shorthands such as ``inset: -16px -8px``
(the second ``-`` is a unary minus on the next value, not an operator) and
``box-shadow: 0 18px 40px -22px color-mix(...)``.  The few selector
combinator cases (``a + b``) keep their space but stay valid CSS.

Everything else is preserved character-for-character. Re-running the script on
already-minified output is a no-op (idempotent) modulo any edits made in the
meantime.

Run from project root:

    python3 scripts/minify_portal_css.py            # minify all assets
    python3 scripts/minify_portal_css.py --check    # report savings, no write
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "services" / "frontend" / "portal" / "assets"

# Sentinel used to protect whitespace inside parentheses (calc, var, etc.) from
# the top-level regex passes. CSS source never contains 0x01.
PAREN_SPACE = "\x01"


def minify_css(text: str) -> str:
    """Conservative paren-aware CSS minifier."""
    out: list[str] = []
    n = len(text)
    i = 0
    paren_depth = 0
    prev_was_space = False

    def emit_space() -> None:
        nonlocal prev_was_space
        if prev_was_space:
            return
        out.append(" " if paren_depth == 0 else PAREN_SPACE)
        prev_was_space = True

    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        # Block comment.
        if c == "/" and nxt == "*":
            end = text.find("*/", i + 2)
            if end == -1:
                break
            preserve = (i + 2 < n) and (text[i + 2] == "!")
            if preserve:
                out.append(text[i : end + 2])
                prev_was_space = False
            else:
                emit_space()
            i = end + 2
            continue

        # String literal — emit verbatim so its inner whitespace stays.
        if c in ('"', "'"):
            j = i + 1
            quote = c
            while j < n:
                ch = text[j]
                if ch == "\\":
                    j += 2
                    continue
                if ch == quote:
                    break
                j += 1
            out.append(text[i : j + 1])
            prev_was_space = False
            i = j + 1
            continue

        # Whitespace — collapse and respect paren depth.
        if c in " \t\r\n\f":
            emit_space()
            i += 1
            continue

        if c == "(":
            paren_depth += 1
        elif c == ")":
            paren_depth = max(0, paren_depth - 1)

        out.append(c)
        prev_was_space = False
        i += 1

    s = "".join(out)

    # Strip whitespace around CSS structural tokens at top level. Inside parens
    # we used PAREN_SPACE, so " " here is always top-level whitespace.
    s = re.sub(r" *([{};,:>~]) *", r"\1", s)
    s = re.sub(r"\( ", "(", s)
    s = re.sub(r" \)", ")", s)
    # Last ;before } is redundant.
    s = s.replace(";}", "}")
    # Restore whitespace inside parens.
    s = s.replace(PAREN_SPACE, " ")
    return s.strip() + "\n"


def brace_balance(text: str) -> tuple[int, int, int]:
    """Quick sanity check: counts of unmatched braces / parens / brackets."""
    in_str: str | None = None
    in_comment = False
    open_b = open_p = open_k = 0
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if in_comment:
            if c == "*" and nxt == "/":
                in_comment = False
                i += 1
        elif in_str is not None:
            if c == "\\":
                i += 1
            elif c == in_str:
                in_str = None
        else:
            if c == "/" and nxt == "*":
                in_comment = True
                i += 1
            elif c in ('"', "'"):
                in_str = c
            elif c == "{":
                open_b += 1
            elif c == "}":
                open_b -= 1
            elif c == "(":
                open_p += 1
            elif c == ")":
                open_p -= 1
            elif c == "[":
                open_k += 1
            elif c == "]":
                open_k -= 1
        i += 1
    return open_b, open_p, open_k


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    if not ASSETS.is_dir():
        print(f"✗ assets dir not found: {ASSETS}", file=sys.stderr)
        return 1

    targets = sorted(ASSETS.glob("*.css"))
    if not targets:
        print(f"✗ no .css files under {ASSETS}", file=sys.stderr)
        return 1

    total_before = 0
    total_after = 0
    failed: list[str] = []
    drift: list[str] = []

    for path in targets:
        original = path.read_text(encoding="utf-8")
        minified = minify_css(original)

        # Sanity: structural tokens must still balance.
        before_balance = brace_balance(original)
        after_balance = brace_balance(minified)
        if before_balance != after_balance:
            failed.append(
                f"{path.relative_to(ROOT)}: balance changed ({before_balance} → {after_balance})"
            )
            continue

        before_size = len(original.encode("utf-8"))
        after_size = len(minified.encode("utf-8"))
        total_before += before_size
        total_after += after_size

        delta_pct = 0.0 if before_size == 0 else (1 - after_size / before_size) * 100
        action = "would write" if check_only else "wrote"
        print(
            f"{action:>11s}  {path.relative_to(ROOT)}: "
            f"{before_size:>7,} → {after_size:>7,} bytes ({delta_pct:5.1f}%)"
        )

        if minified != original:
            if check_only:
                drift.append(str(path.relative_to(ROOT)))
            else:
                path.write_text(minified, encoding="utf-8")

    if failed:
        print("\n✗ Refused to write — brace/paren balance mismatch:", file=sys.stderr)
        for line in failed:
            print(f"  {line}", file=sys.stderr)
        return 2

    if total_before:
        delta_pct = (1 - total_after / total_before) * 100
        print(
            f"\n{'TOTAL':>11s}: {total_before:>7,} → {total_after:>7,} bytes "
            f"({delta_pct:.1f}% saved)"
        )

    if check_only and drift:
        print(
            "\n✗ CSS drift — these files are not minified. "
            "Run: python3 scripts/minify_portal_css.py",
            file=sys.stderr,
        )
        for name in drift:
            print(f"  {name}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
