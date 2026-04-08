"""Regenerate rendered UML diagrams for project documentation.

Usage:
  python scripts/regenerate_docs.py
  python scripts/regenerate_docs.py --watch
"""

from __future__ import annotations

import argparse
import subprocess
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
UML_SRC_DIR = PROJECT_ROOT / "docs" / "uml"
UML_OUT_DIR = PROJECT_ROOT / "docs" / "uml" / "rendered"
KROKI_URL = "https://kroki.io/plantuml/png"


def _source_files() -> list[Path]:
    """Return all PlantUML source files under docs/uml, excluding rendered."""
    files = sorted(UML_SRC_DIR.rglob("*.puml"))
    return [f for f in files if "rendered" not in f.parts]


def _output_for(source_path: Path) -> Path:
    """Map source .puml to a stable output filename in rendered/."""
    rel = source_path.relative_to(UML_SRC_DIR)
    # Keep legacy names for sequence diagrams to avoid breaking docs/index.html.
    if rel.parts and rel.parts[0] == "sequences":
        safe_name = source_path.stem + ".png"
    else:
        # Keep filenames stable and unique across non-sequence subdirectories.
        safe_name = "__".join(rel.with_suffix("").parts) + ".png"
    return UML_OUT_DIR / safe_name


def render_one(source_path: Path, output_path: Path) -> None:
    """Render one PlantUML file to PNG using Kroki via curl."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "curl",
        "-k",
        "-sS",
        "-X",
        "POST",
        "-H",
        "Content-Type: text/plain",
        "--data-binary",
        f"@{source_path}",
        KROKI_URL,
        "-o",
        str(output_path),
    ]
    subprocess.run(cmd, check=True)


def render_all(verbose: bool = True) -> int:
    """Render all UML diagrams and return number of files."""
    files = _source_files()
    for src in files:
        out = _output_for(src)
        render_one(src, out)
        if verbose:
            print(f"rendered: {out.relative_to(PROJECT_ROOT)}")
    return len(files)


def watch(interval_sec: float = 1.0) -> None:
    """Watch UML source files and rerender changed ones."""
    print("watch mode enabled: monitoring docs/uml/**/*.puml")
    mtimes: dict[Path, float] = {}
    for src in _source_files():
        mtimes[src] = src.stat().st_mtime

    total = render_all(verbose=True)
    print(f"initial render done: {total} file(s)")

    while True:
        changed = []
        current_files = _source_files()
        for src in current_files:
            mtime = src.stat().st_mtime
            if src not in mtimes or mtimes[src] != mtime:
                changed.append(src)
                mtimes[src] = mtime

        for src in changed:
            out = _output_for(src)
            render_one(src, out)
            print(f"updated: {out.relative_to(PROJECT_ROOT)}")

        removed = [path for path in mtimes if path not in current_files]
        for path in removed:
            mtimes.pop(path, None)
            out = _output_for(path)
            if out.exists():
                out.unlink()
                print(f"removed: {out.relative_to(PROJECT_ROOT)}")

        time.sleep(interval_sec)


def main() -> None:
    """CLI entrypoint."""
    parser = argparse.ArgumentParser(description="Regenerate UML diagrams for docs.")
    parser.add_argument("--watch", action="store_true", help="Watch source files and rerender on changes.")
    parser.add_argument("--interval", type=float, default=1.0, help="Watch polling interval in seconds.")
    args = parser.parse_args()

    if args.watch:
        watch(interval_sec=args.interval)
        return

    total = render_all(verbose=True)
    print(f"done: rendered {total} file(s)")


if __name__ == "__main__":
    main()
