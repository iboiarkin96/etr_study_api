#!/usr/bin/env python3
"""Detect token drift between the production TMA tokens file and the UI Kit
showcase file.

`services/telegram/src/styles/tokens.css` is the canonical source of truth
for every `--tma-*` custom property the app reads. The UI-Kit showcase
`services/frontend/portal/assets_v2/ui-kit/components/tma-kit.css`
`@import`s that file, but ALSO declares its own tokens in a `:root` and
`.tma-scope` block for showcase-only chrome (iris legacy alias, grain URL,
accent-text for surfaces outside `.tma-scope`, extra motion timings,
gradient materials never used in production, etc.).

If a token declared in src is ALSO declared in the kit — and the values
differ — the kit's declaration silently overrides src on kit pages and
tokens.html shows the wrong swatch. This check flags every such conflict.

Rules:

  1. Every `--tma-*` declared in the kit is compared against src.
  2. Values must be byte-identical after whitespace normalisation.
  3. Kit-only tokens (declared only in the kit) are ignored — they are the
     legitimate showcase-only surface area.

Exit codes: 0 = no drift, 1 = at least one conflict.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SRC_TOKENS = REPO_ROOT / "services" / "telegram" / "src" / "styles" / "tokens.css"
KIT_TOKENS = (
    REPO_ROOT
    / "services"
    / "frontend"
    / "portal"
    / "assets_v2"
    / "ui-kit"
    / "components"
    / "tma-kit.css"
)

# --tma-foo: <value>;  — captures name + raw value (single-line only)
DECL_RE = re.compile(r"(--tma-[a-z0-9-]+)\s*:\s*([^;]+);", re.IGNORECASE)

# Tier-1 palette tokens — context-independent (no light/dark/density
# override should ever change these). These are the ONLY tokens the
# checker compares byte-for-byte. Semantic tokens legitimately differ
# per selector (light-mode surface flip, compact-density cell height,
# ambience-tinted canvas on kit chrome) and are skipped.
PALETTE_PREFIXES = (
    "--tma-neutral-",
    "--tma-ember-",
    "--tma-sage-",
    "--tma-success-",
    "--tma-warning-",
    "--tma-danger-",
    "--tma-info-",
    # spacing scale — same values across themes / densities
    "--tma-sp-",
    # radius scale — same
    "--tma-rad-",
    # font-size / weight / line-height / tracking — same
    "--tma-fs-",
    "--tma-fw-",
    "--tma-lh-",
    "--tma-tr-",
    # motion timings (single global value)
    "--tma-dur-",
)


def is_palette(token: str) -> bool:
    return token.startswith(PALETTE_PREFIXES)


def normalise(value: str) -> str:
    """Aggressively normalise so cosmetic reformatting doesn't count as drift.

    Removes all whitespace inside function-argument lists and unifies
    single- vs double-quotes so `'Inter'` and `"Inter"` compare equal.
    """
    value = value.replace('"', "'")
    return re.sub(r"\s+", " ", value).strip().rstrip(";").strip()


def load_palette(path: Path) -> dict[str, str]:
    """Extract palette-tier `--tma-*: <value>;` declarations only.

    Multiple declarations of the same token collapse to the last one — that
    matches how CSS itself resolves the cascade for identical selectors.
    Non-palette tokens are skipped because they may legitimately differ
    per selector context (theme / density / ambience overrides).
    """
    text = path.read_text(encoding="utf-8")
    tokens: dict[str, str] = {}
    for match in DECL_RE.finditer(text):
        name = match.group(1)
        if not is_palette(name):
            continue
        tokens[name] = normalise(match.group(2))
    return tokens


def main() -> int:
    if not SRC_TOKENS.is_file():
        print(f"check_token_drift: source file missing at {SRC_TOKENS} — skipped.")
        return 0
    if not KIT_TOKENS.is_file():
        print(f"check_token_drift: kit file missing at {KIT_TOKENS} — skipped.")
        return 0

    src = load_palette(SRC_TOKENS)
    kit = load_palette(KIT_TOKENS)

    conflicts: list[tuple[str, str, str]] = []
    for token, src_value in src.items():
        if token in kit and kit[token] != src_value:
            conflicts.append((token, src_value, kit[token]))

    if not conflicts:
        print(
            f"check_token_drift: OK — {len(src)} palette tokens checked "
            f"(colour scale, spacing, radius, type, motion timings)."
        )
        return 0

    print(
        f"check_token_drift: FAIL — {len(conflicts)} token(s) drift between\n"
        f"  src: {SRC_TOKENS.relative_to(REPO_ROOT)}\n"
        f"  kit: {KIT_TOKENS.relative_to(REPO_ROOT)}\n"
    )
    for token, src_value, kit_value in conflicts:
        print(f"  ✗ {token}")
        print(f"      src: {src_value}")
        print(f"      kit: {kit_value}")
    print(
        "\nFix: either update the kit's declaration to match src, or delete "
        "the kit-side declaration entirely (the @import in tma-kit.css already "
        "pulls the src value in).\n"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
