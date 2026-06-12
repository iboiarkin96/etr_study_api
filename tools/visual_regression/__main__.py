"""CLI entry: `python -m tools.visual_regression --mode check|update`."""

from __future__ import annotations

import sys

from .runner import main

sys.exit(main())
