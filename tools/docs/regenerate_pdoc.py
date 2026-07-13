"""Regenerate the Python API reference (pdoc) — only when source changed.

pdoc runs deterministically-enough after we normalise its output, but it is still
one of the slowest steps in ``make docs-fix`` and its output only depends on
Python source under ``services/api/app/**``. This wrapper adds the same
fingerprint-and-skip pattern that ``regenerate_docs.py`` uses for PlantUML: hash
the inputs, compare against the last recorded hash, and skip the pdoc + normalize
run when nothing has changed.

Usage:
    python tools/docs/regenerate_pdoc.py               # skip if unchanged
    python tools/docs/regenerate_pdoc.py --force       # rebuild anyway
    python tools/docs/regenerate_pdoc.py --check       # exit non-zero if drift is present
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
API_SOURCE_ROOT = PROJECT_ROOT / "services" / "api" / "app"
OUTPUT_ROOT = (
    PROJECT_ROOT / "services" / "portal" / "internal" / "services" / "api" / "code-reference"
)
FINGERPRINT_PATH = OUTPUT_ROOT / ".pdoc-input-hashes.json"
FINGERPRINT_VERSION = 1

NO_COLOR = os.getenv("NO_COLOR", "0") == "1"
_RESET = "" if NO_COLOR else "\033[0m"
_GREEN = "" if NO_COLOR else "\033[32m"
_CYAN = "" if NO_COLOR else "\033[36m"
_YELLOW = "" if NO_COLOR else "\033[33m"
_ICON_OK = f"{_GREEN}✓{_RESET}"
_ICON_SKIP = f"{_YELLOW}⟳{_RESET}"
_ICON_STEP = f"{_CYAN}→{_RESET}"


def _log(icon: str, message: str) -> None:
    """Emit a status line with the given icon prefix."""
    print(f"{icon} {message}")


def _iter_python_sources() -> list[Path]:
    """Return every ``*.py`` file under the API app package, sorted for stable hashing.

    Excludes pycache and any hidden dotfile.
    """
    files: list[Path] = []
    for path in API_SOURCE_ROOT.rglob("*.py"):
        if "__pycache__" in path.parts:
            continue
        if any(part.startswith(".") for part in path.parts):
            continue
        files.append(path)
    return sorted(files)


def _hash_source_tree(files: list[Path]) -> str:
    """Return a SHA-256 hex digest that changes whenever any input file changes.

    Args:
        files: Sorted list of Python source paths.

    Returns:
        Deterministic hex digest over ``(relative_path, file_bytes)`` pairs.
    """
    digest = hashlib.sha256()
    for path in files:
        rel = path.relative_to(PROJECT_ROOT).as_posix()
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _load_fingerprint() -> str | None:
    """Return the previously stored input hash, or ``None`` when the file is absent/invalid."""
    if not FINGERPRINT_PATH.is_file():
        return None
    try:
        payload = json.loads(FINGERPRINT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("version") != FINGERPRINT_VERSION:
        return None
    value = payload.get("input_hash")
    return value if isinstance(value, str) else None


def _save_fingerprint(input_hash: str) -> None:
    """Persist the current input hash alongside the pdoc output tree."""
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    payload = {"version": FINGERPRINT_VERSION, "input_hash": input_hash}
    FINGERPRINT_PATH.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _require_node_for_pdoc_search() -> None:
    """Fail loudly when ``node`` isn't on ``PATH`` — pdoc silently degrades otherwise.

    pdoc's ``search.js`` has two shapes:

      * With a JS runtime available it precompiles the lunr index and emits
        ``docs = {"_isPrebuiltIndex": true, …}``.
      * Without one it falls back to shipping the raw document array
        ``docs = [{"doc": …}, …]`` and expects the client to build the
        index on page load.

    The two shapes are byte-different. CI's GH Actions runner always has
    ``node`` (image comes with it preinstalled); a stock ``python:3.11-slim``
    docker image does not. Regenerating pdoc without ``node`` on a
    contributor's machine therefore produces the raw-array form, commits
    it, then CI regenerates the prebuilt form and fails ``docs-check``
    with a full-file drift.

    Fail here with a clear error so nobody discovers this by pushing.
    """
    import shutil as _shutil

    if _shutil.which("node") is None and _shutil.which("nodejs") is None:
        raise SystemExit(
            "pdoc regen requires node (or nodejs) on PATH to precompile the lunr "
            "search index — otherwise `search.js` will drift against CI. "
            "Install node.js locally, or run this inside a container that has it "
            "(e.g. `docker run … node:20-slim …`)."
        )


def _run_pdoc() -> None:
    """Execute pdoc + normalize into a temp tree, then sync only files that actually changed.

    Writing directly into ``OUTPUT_ROOT`` would emit hundreds of filesystem-modified
    events even when output is byte-identical to what is already committed — IDEs
    and file watchers see every file "flicker" from removed → re-created. Building
    in a temp dir and comparing content byte-for-byte before writing lets us keep
    the disk quiet on the common no-change path.
    """
    _require_node_for_pdoc_search()
    env = os.environ.copy()
    env.setdefault("PYTHONHASHSEED", "0")
    env["PYTHONPATH"] = f"services/api{os.pathsep}{env.get('PYTHONPATH', '')}"
    # Pin the workspace-root the app package reports at import time. ``config.py``
    # otherwise builds ``ENV_DIR = ROOT / "env"`` from ``Path(__file__).resolve()``,
    # which encodes the runner's CWD in every rendered ``PosixPath(...)`` repr and
    # — worse — in the pdoc search index's per-field character counts (which
    # ``normalize_pdoc_output.py`` cannot fix in retrospect because pdoc has
    # already frozen them before we run). Pinning to a fixed short path yields
    # a byte-identical index on every runner.
    env["STUDY_APP_ROOT"] = "/study_app"
    # The pinned root has no ``env/<APP_ENV>`` file, so ``config.get_settings()``
    # falls through to reading the parent environment. It still raises on a
    # missing ``DATABASE_URL`` (the only required knob per ADR 0037), so pass a
    # placeholder DSN that satisfies the format check without pointing at a
    # real database — pdoc never opens a connection during import.
    env.setdefault(
        "DATABASE_URL",
        "postgresql+psycopg://pdoc:pdoc@127.0.0.1:5432/pdoc",
    )

    with tempfile.TemporaryDirectory(prefix="pdoc-regen-") as tmp:
        stage_dir = Path(tmp) / "code-reference"
        subprocess.run(
            [sys.executable, "-m", "pdoc", "app", "-o", str(stage_dir)],
            check=True,
            cwd=PROJECT_ROOT,
            env=env,
        )
        # normalize_pdoc_output.py reads from the project's canonical location, so we
        # temporarily point it at the staging tree via env-driven override.
        env_norm = env.copy()
        env_norm["PDOC_OUTPUT_OVERRIDE"] = str(stage_dir)
        subprocess.run(
            [sys.executable, "tools/docs/normalize_pdoc_output.py"],
            check=True,
            cwd=PROJECT_ROOT,
            env=env_norm,
        )
        _sync_tree(source=stage_dir, target=OUTPUT_ROOT)


def _sync_tree(*, source: Path, target: Path) -> None:
    """Reflect ``source`` into ``target`` without touching files whose bytes match.

    Adds missing directories, writes files whose bytes differ, and removes stale
    files under ``target`` that no longer exist in ``source``. The fingerprint
    file ``.pdoc-input-hashes.json`` in ``target`` is preserved.
    """
    target.mkdir(parents=True, exist_ok=True)
    source_relatives: set[Path] = set()
    for src in source.rglob("*"):
        rel = src.relative_to(source)
        source_relatives.add(rel)
        dst = target / rel
        if src.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
            continue
        new_bytes = src.read_bytes()
        if dst.is_file() and dst.read_bytes() == new_bytes:
            continue  # byte-identical → skip the write to keep mtime stable
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(new_bytes)

    protected = {Path(FINGERPRINT_PATH.name)}
    for existing in list(target.rglob("*")):
        rel = existing.relative_to(target)
        if rel in protected or rel in source_relatives:
            continue
        if any(part in protected for part in rel.parents):
            continue
        if existing.is_file():
            existing.unlink()
    # Clean up empty directories left behind after file removals.
    for existing in sorted(target.rglob("*"), key=lambda p: -len(p.parts)):
        if existing.is_dir() and not any(existing.iterdir()):
            existing.rmdir()


def main() -> int:
    """Skip / regen / check pdoc output based on Python source fingerprint."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--force", action="store_true", help="Rebuild even when the fingerprint matches."
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero when the current sources hash to a value different from the stored fingerprint.",
    )
    args = parser.parse_args()

    files = _iter_python_sources()
    current_hash = _hash_source_tree(files)
    stored_hash = _load_fingerprint()

    if args.check:
        if stored_hash is None:
            _log(_ICON_STEP, "no stored fingerprint — pdoc regen required")
            return 1
        if stored_hash != current_hash:
            _log(_ICON_STEP, "Python source has changed since last pdoc run — regen required")
            return 1
        _log(_ICON_OK, "pdoc fingerprint matches source tree")
        return 0

    if not args.force and stored_hash == current_hash:
        _log(_ICON_SKIP, f"pdoc skipped — {len(files)} source files unchanged since last run")
        return 0

    reason = "forced" if args.force else "source tree changed"
    _log(_ICON_STEP, f"Regenerating pdoc ({reason}, {len(files)} source files)")
    _run_pdoc()
    _save_fingerprint(current_hash)
    _log(_ICON_OK, "pdoc regenerated and fingerprint updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
