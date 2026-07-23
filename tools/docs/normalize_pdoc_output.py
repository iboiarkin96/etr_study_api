"""Determinism-only post-process for pdoc output under code-reference/.

pdoc emits nondeterministic content on every run:

  1. ``<function foo at 0x10ab02c40>`` reprs (HTML-escaped or plain text) — the
     memory address changes across processes, so the HTML diffs on every run.
  2. The embedded lunr search index in ``search.js`` — Python's hash
     randomisation reshuffles dict keys, so the serialised JSON drifts even
     when the indexed content is identical.
  3. Env-specific reprs of live objects — ``PosixPath('/…/logs/app.log')`` where
     ``/…/`` is the process CWD, ``<module 'datetime' from
     '/usr/local/lib/python3.11/datetime.py'>`` where the absolute path is
     hardcoded by the Python patch build, ``Settings(…, database_url=
     '***127.0.0.1:5432/study_app', …)`` where the DSN slug is whatever ``.env``
     the runner happens to have. Any contributor with a differently-shaped
     workspace produces different HTML.
  4. ``frozenset({…})`` iteration order — even with ``PYTHONHASHSEED=0`` the
     insertion order that survives to ``repr()`` depends on the runtime's
     ``zoneinfo``/``tzdata`` build, and drifts between Python patch versions.

All four are *structural* noise — pdoc cannot avoid them without a config flag
we don't have. This post-processor strips or canonicalises each variant so the
committed snapshot is stable across machines and runs.

The regex passes accept both HTML entity forms of a single quote — ``&#39;``
(decimal) as used in the rendered pages, and ``&#x27;`` (hex) as used inside
the JSON payload of ``search.js`` — via a shared ``_Q`` alternation.

No styling, font, favicon, chrome, or any other rendered content is touched.
Run only after ``python -m pdoc app -o services/portal/internal/services/api/code-reference``.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_DOCS_API = (
    ROOT / "services" / "portal" / "internal" / "services" / "api" / "code-reference"
)


def _resolve_docs_api() -> Path:
    """Return the pdoc output tree to normalize.

    Honours ``PDOC_OUTPUT_OVERRIDE`` when set — used by ``regenerate_pdoc.py`` to
    normalise a staging tree before rsync-style syncing it into the canonical
    location, so the on-disk files aren't rewritten unless their bytes changed.
    """
    override = os.getenv("PDOC_OUTPUT_OVERRIDE")
    if override:
        return Path(override)
    return _DEFAULT_DOCS_API


DOCS_API = _resolve_docs_api()

# Single-quote HTML entity, decimal or hex — same character rendered by
# different encoders. HTML pages use ``&#39;``; the ``search.js`` JSON payload
# uses ``&#x27;``.
_Q = r"(?:&#39;|&#x27;)"

# e.g. ``<function foo at 0x10ab02c40>`` in HTML-escaped form or plain text
_AT_ADDR = re.compile(r" at 0x[0-9a-f]{8,16}")

# pdoc ``search.js`` embeds the lunr index as ``const docs = {...};``
_SEARCH_JS_MARKER = "/** pdoc search index */const docs = "

# ``PosixPath('/…/logs/app.log')`` → keep only ``logs/app.log``.
_POSIXPATH_LOGFILE = re.compile(
    rf"PosixPath\({_Q}[^&]*?/(logs/app\.log){_Q}\)",
)
# Repo-root scalars — ``ENV_DIR`` etc., rendered as absolute PosixPath.
# Anything containing a segment that names a well-known repo folder gets
# normalised to just the trailing segment.
_POSIXPATH_REPO_ROOT = re.compile(
    rf"PosixPath\({_Q}/[^&]*?/(env|services|tests|tools|logs|var){_Q}\)"
)

# ``Engine(…)`` + ``sessionmaker(bind=Engine(…), …)`` — SQLAlchemy's URL repr
# scrubs credentials differently across builds (``***…host…/db`` in one
# version, ``user:***@host…/db`` in another), and even after scrubbing the
# DSN suffix (host + DB name) depends on ``.env`` on the runner. Normalise
# any ``Engine(…)`` to a canonical placeholder.
_ENGINE_REPR = re.compile(r"Engine\([^)]*?\)")

# ``<module 'datetime' from '/usr/local/lib/python3.11/datetime.py'>`` — the
# ``from '…'`` clause exposes the interpreter's install prefix and drifts
# between Python patch versions and hosting environments. Drop it.
#
# Two forms:
#   1. Plain text (inline reprs): ``&lt;module 'X' from 'Y'&gt;``
#   2. Pygments-highlighted (in code blocks): a chain of spans like
#      ``'X'</span> … <span class="kn">from</span> … <span class="s1">'Y'</span>``
_MODULE_FROM_PATH_TEXT = re.compile(
    rf"(&lt;)(module )({_Q}[^&]*?{_Q})( from {_Q}[^&]*?{_Q})(&gt;)",
)
_MODULE_FROM_PATH_PYGMENTS = re.compile(
    rf"({_Q}[^&]*?{_Q})</span>"
    r'(?:<span class="w">[^<]*</span>|\s)*'
    r'<span class="kn">from</span>'
    r'(?:<span class="w">[^<]*</span>|\s)*'
    rf'<span class="s1">{_Q}[^&]*?{_Q}</span>'
)

# ``database_url='…'`` — the DSN depends on the ``.env`` the runner has
# (``x:x@…/x`` in a scratch container, ``study_app:study_app@…/study_app`` on
# the CI runner). Different builds also mask credentials differently
# (SQLAlchemy's URL repr uses ``***`` scrubbing, dataclass ``repr`` doesn't).
# Canonicalise the whole rendered value so the diff is stable across all envs.
_SETTINGS_DATABASE_URL = re.compile(
    rf"database_url={_Q}[^&]*?{_Q}",
)

# ``frozenset({…})`` — iteration order varies with ``zoneinfo``/``tzdata``
# builds. Split on ``', '`` between quoted strings, sort, reassemble.
_FROZENSET_STRINGS = re.compile(rf"frozenset\(\{{({_Q}[^\}}]*{_Q})\}}\)")

# ``VALID_TIMEZONES`` default-value block — the *contents* of the frozenset
# (which timezones exist) depend on the host OS's ``/usr/share/zoneinfo`` /
# ``tzdata`` bundle. macOS ships ~600 zones, Ubuntu CI runners ship a slightly
# different set (aliases removed, new zones added between tzdata releases).
# Sorting alone is not enough — the *set membership* differs. Replace the
# rendered value with a canonical placeholder so contributors on any OS produce
# the same HTML. The variable's docstring / annotation are unaffected.
_VALID_TIMEZONES_VALUE = re.compile(
    r'(<label class="view-value-button pdoc-button" '
    r'for="VALID_TIMEZONES-view-value"></label>'
    r'<span class="default_value">)'
    r"frozenset\(\{[^}]*\}\)"
    r"(</span>)"
)


def _canonicalize_module_from_path(match: re.Match[str]) -> str:
    """Drop the ``from '…'`` clause from a rendered ``<module …>`` repr."""
    return f"{match.group(1)}{match.group(2)}{match.group(3)}{match.group(5)}"


def _canonicalize_frozenset_of_strings(match: re.Match[str]) -> str:
    """Sort a ``frozenset({...})`` of HTML-escaped strings for a stable render."""
    body = match.group(1)
    parts = [p.strip() for p in body.split(",")]
    parts.sort()
    return "frozenset({" + ", ".join(parts) + "})"


def _canonicalize_env_specific_reprs(text: str) -> str:
    """Apply all env-independent normalisations that touch rendered Python reprs.

    Args:
        text: HTML (or ``search.js`` JSON) content of one pdoc-generated page.

    Returns:
        Same content with env-dependent reprs canonicalised.
    """
    text = _POSIXPATH_LOGFILE.sub(r"PosixPath(&#39;\1&#39;)", text)
    text = _POSIXPATH_REPO_ROOT.sub(r"PosixPath(&#39;\1&#39;)", text)
    text = _MODULE_FROM_PATH_TEXT.sub(_canonicalize_module_from_path, text)
    text = _MODULE_FROM_PATH_PYGMENTS.sub(r"\1</span>", text)
    text = _SETTINGS_DATABASE_URL.sub(
        "database_url=&#39;***HOST:5432/DB&#39;",
        text,
    )
    text = _ENGINE_REPR.sub("Engine(***HOST:5432/DB)", text)
    text = _FROZENSET_STRINGS.sub(_canonicalize_frozenset_of_strings, text)
    text = _VALID_TIMEZONES_VALUE.sub(
        r"\1frozenset({&lt;IANA-timezones · OS-dependent&gt;})\2",
        text,
    )
    return text


def main() -> int:
    """Walk pdoc output, strip addresses, re-serialise search.js index sorted."""
    if not DOCS_API.is_dir():
        print(
            "services/portal/internal/services/api/code-reference missing; skip pdoc normalization",
            file=sys.stderr,
        )
        return 0
    changed = 0
    for path in list(DOCS_API.rglob("*.html")) + [DOCS_API / "search.js"]:
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        new = _AT_ADDR.sub("", text)
        new = _canonicalize_env_specific_reprs(new)
        if path.name == "search.js":
            new = _canonicalize_pdoc_search_js(new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1

    if changed:
        print(
            f"Normalized pdoc output (determinism only) in {changed} file(s) under "
            "services/portal/internal/services/api/code-reference/"
        )
    return 0


def _canonicalize_pdoc_search_js(text: str) -> str:
    """Rewrite embedded lunr index JSON with sorted keys for deterministic output."""
    idx = text.find(_SEARCH_JS_MARKER)
    if idx == -1:
        return text
    start = idx + len(_SEARCH_JS_MARKER)
    try:
        data, end_idx = json.JSONDecoder().raw_decode(text, start)
    except json.JSONDecodeError:
        return text
    serialized = json.dumps(
        data,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return text[:start] + serialized + text[end_idx:]


if __name__ == "__main__":
    raise SystemExit(main())
