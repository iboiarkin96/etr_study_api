"""Check that ``Path(...) / "literal"`` chains in ``scripts/*.py`` resolve on disk.

The repo has been through several bulk-rename refactors. The recurring failure
mode is a Python script holding a stale path literal (``ROOT / "services" / "portal" / "assets"``)
that no longer exists. The script then silently no-ops (or worse, writes to
the wrong location).

This checker walks the AST of every ``scripts/*.py`` file, finds chains rooted
at one of the recognised "anchor" names (``ROOT``, ``REPO``, ``BASE``, ``DOCS``,
``DOCS_DIR``, ``DOCS_ROOT``), follows the ``/ "string"`` joins, and reports
chains where the resolved path does not exist on disk.

Output paths (paths the script *writes* rather than reads) cannot be told apart
purely from syntax. As a heuristic we accept any chain whose final string
component looks like an explicit output target — i.e. it ends in a known
generated-artifact basename (e.g. ``search-index.json``,
``token-gallery``) — by passing through if the parent directory exists.

Run: ``python scripts/check_path_literals.py`` (exit 1 on any unresolved chain).
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"

ANCHOR_NAMES = {"ROOT", "REPO", "BASE", "DOCS", "DOCS_DIR", "DOCS_ROOT", "REPO_ROOT"}

# Basenames that are KNOWN to be generated outputs — accept if parent exists.
OUTPUT_BASENAMES = {
    "search-index.json",
    "search-index-public.json",
    "docs-frontend-token-gallery.html",
    "ia_manifest.csv",
}

# Directories that are conventionally gitignored output sinks. A chain whose
# top-level non-anchor part is one of these is accepted unconditionally —
# scripts create them on demand.
OUTPUT_DIRS = {"tmp", "var", "build", "dist"}


def _collect_anchors(tree: ast.AST) -> dict[str, Path]:
    """Find module-level ``NAME = Path(__file__).resolve().parent[s][...]`` assignments.

    We don't try to evaluate them — we just trust that the conventional anchors
    point at sensible roots:

    * ``ROOT`` / ``REPO`` / ``REPO_ROOT`` / ``BASE`` → repo root
    * ``DOCS`` / ``DOCS_DIR`` / ``DOCS_ROOT`` → ``services/portal``
    """
    out: dict[str, Path] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
            continue
        name = node.targets[0].id
        if name in ("ROOT", "REPO", "REPO_ROOT", "BASE"):
            out[name] = ROOT
        elif name in ("DOCS", "DOCS_DIR", "DOCS_ROOT"):
            out[name] = ROOT / "services" / "portal"
    return out


def _flatten_div(node: ast.AST) -> tuple[str | None, list[str]] | None:
    """Walk ``X / "a" / "b" / "c"`` and return (anchor_name, ["a", "b", "c"]) or ``None``."""
    parts: list[str] = []
    cur: ast.AST = node
    while isinstance(cur, ast.BinOp) and isinstance(cur.op, ast.Div):
        right = cur.right
        if isinstance(right, ast.Constant) and isinstance(right.value, str):
            parts.append(right.value)
        else:
            return None
        cur = cur.left
    if not isinstance(cur, ast.Name):
        return None
    parts.reverse()
    return cur.id, parts


def _check_chain(file: Path, line_no: int, anchor: Path, parts: list[str]) -> str | None:
    if not parts:
        return None
    target = anchor
    for part in parts:
        target = target / part
    if target.exists():
        return None
    if parts[-1] in OUTPUT_BASENAMES and target.parent.exists():
        return None
    if parts and parts[0] in OUTPUT_DIRS:
        return None
    rel_anchor = anchor.relative_to(ROOT).as_posix() or "."
    rel_target = "/".join(parts)
    return f"  {file.relative_to(ROOT)}:{line_no}  {rel_anchor} / {rel_target}  (not found)"


def main() -> int:
    failures: list[str] = []
    checked = 0

    for path in sorted(SCRIPTS.glob("*.py")):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except (OSError, SyntaxError) as exc:
            print(f"! {path.relative_to(ROOT)}: {exc}", file=sys.stderr)
            continue
        anchors = _collect_anchors(tree)
        if not anchors:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.BinOp) or not isinstance(node.op, ast.Div):
                continue
            flat = _flatten_div(node)
            if not flat:
                continue
            anchor_name, parts = flat
            if anchor_name not in anchors:
                continue
            checked += 1
            issue = _check_chain(path, node.lineno, anchors[anchor_name], parts)
            if issue:
                failures.append(issue)

    if not failures:
        print(f"check_path_literals: OK — {checked} Path chains checked, all resolve.")
        return 0

    print(
        f"check_path_literals: FAIL — {len(failures)} unresolved Path chains "
        f"(of {checked} checked):",
        file=sys.stderr,
    )
    for line in failures[:200]:
        print(line, file=sys.stderr)
    if len(failures) > 200:
        print(f"  … and {len(failures) - 200} more", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
