"""Boundary checker: forbid cross-service imports inside services/<svc>/.

Each service folder under :file:`services/<svc>/` owns its Python modules. A
script or test inside one service must not import modules owned by another
service — that's the architectural boundary ADR 0028 ratifies.

Today only the API service owns a Python package (``app``, with intermediate
``alembic`` migration helpers also living under :file:`services/api/`). After
the package rename to ``api`` (master plan C7) the same rules apply with the
renamed top-level. The checker grows the map by editing :data:`OWNED_TOP_LEVELS`.

Allowed:
  • imports inside the same service (e.g. ``app.core.config`` from
    :file:`services/api/scripts/openapi_governance.py``)
  • imports of third-party libs, stdlib, ``tools.*``, ``_shared.*``
  • cross-cutting test/dev utilities from :file:`tests/` or :file:`tools/`

Forbidden:
  • ``from app.…`` inside :file:`services/portal/`
  • ``from app.…`` inside :file:`services/monitoring/`
  • symmetrically for the renamed top-level (``api``) once C7 lands

Exemption — files that legitimately introspect another service at build time
(e.g. :file:`services/portal/scripts/sync_docs.py` extracts the FastAPI route
table and stable-error catalog for the docs autogen) can opt out by adding the
marker line ``# check_service_imports: allow`` at the top of the file. The
exemption is opt-in per file so a forgotten import in unrelated code still
fails the gate.

Run::

    .venv/bin/python _shared/scripts/check_service_imports.py

Exit code ``1`` lists every violation with file + line and the offending
import; ``0`` on a clean tree. Wired into ``.pre-commit-config.yaml`` as
the ``check-service-imports`` local hook.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SERVICES_DIR = ROOT / "services"

# top-level module name → service folder that owns it.
# After the C7 rename, add "api" → "api" alongside the existing "app" → "api".
OWNED_TOP_LEVELS: dict[str, str] = {
    "app": "api",
}


def _owner_service(file: Path) -> str | None:
    """Return the service folder name that owns ``file``, or ``None`` if outside services/."""
    try:
        rel = file.resolve().relative_to(SERVICES_DIR)
    except ValueError:
        return None
    parts = rel.parts
    return parts[0] if parts else None


def _import_top_levels(tree: ast.AST) -> list[tuple[int, str]]:
    """Return ``(line_no, top_level_module)`` for every import in the AST."""
    out: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                out.append((node.lineno, alias.name.split(".")[0]))
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.level == 0:
                out.append((node.lineno, node.module.split(".")[0]))
    return out


def main() -> int:
    """Walk services/<svc>/**/*.py; report any cross-service top-level import."""
    failures: list[str] = []
    checked = 0

    for py in SERVICES_DIR.rglob("*.py"):
        if any(part in {"__pycache__", "alembic"} for part in py.parts):
            # alembic/versions/ migrations import from app.* by design (owner: same service).
            # Skip the noisy folder; the legitimate `from app.…` inside api/alembic/env.py
            # is already inside the owner.
            continue
        owner = _owner_service(py)
        if owner is None:
            continue
        try:
            source = py.read_text(encoding="utf-8")
            tree = ast.parse(source)
        except (OSError, SyntaxError) as exc:
            print(f"! {py.relative_to(ROOT)}: {exc}", file=sys.stderr)
            continue
        checked += 1
        if "# check_service_imports: allow" in source[:2000]:
            continue
        for line_no, top in _import_top_levels(tree):
            mod_owner = OWNED_TOP_LEVELS.get(top)
            if mod_owner is None or mod_owner == owner:
                continue
            failures.append(
                f"  {py.relative_to(ROOT)}:{line_no}  "
                f"top-level `{top}` is owned by services/{mod_owner}/ "
                f"but the file lives in services/{owner}/"
            )

    if failures:
        print(
            f"check_service_imports: FAIL — {len(failures)} cross-service imports:", file=sys.stderr
        )
        for line in failures:
            print(line, file=sys.stderr)
        return 1
    print(f"check_service_imports: OK — {checked} files checked, no cross-service imports.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
