"""Top-level ``tools`` package for optional developer workflows.

Load testing lives under :mod:`tools.load_testing`; see ``tools/load_testing/README.html`` for usage.

After ADR 0028 Phase 1 the API package lives at ``services/api/app/``. Make it importable as
``app.*`` whenever any ``tools.*`` submodule is loaded (load-testing scenarios import
``app.schemas.user`` etc.). The repo root is also added so ``tools.load_testing.*`` remains
importable as before.
"""

from __future__ import annotations

import sys as _sys
from pathlib import Path as _Path

_REPO_ROOT = _Path(__file__).resolve().parent.parent
_API_SRC = _REPO_ROOT / "services" / "api"
for _path in (_REPO_ROOT, _API_SRC):
    _p = str(_path)
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
