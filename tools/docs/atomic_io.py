"""Byte-identical no-op writer used across the docs autogen pipeline.

Every docs autogen tool (``format_docs_html.py``, ``build_catalog.py``,
``sync_docs.py`` and friends) rewrites its target files unconditionally. Even
when the freshly computed content is identical to what's already on disk, the
file's ``mtime`` moves, which:

* makes IDEs flash the file as ``modified`` mid-``make docs-check``,
* wakes up file watchers (LSP, live-reload) for nothing,
* produces noisy git status entries when a tool is nudged locally.

This module wraps every write with a byte-level compare against the existing
file. When the bytes match, ``write_if_changed`` is a no-op and the file's
mtime stays untouched.

Use it for every write of an on-disk artefact whose content is fully derived
from other sources — HTML, JSON, TXT, CSS, JS, etc.
"""

from __future__ import annotations

from pathlib import Path

_Payload = str | bytes


def _to_bytes(data: _Payload, *, encoding: str) -> bytes:
    """Normalise ``str`` / ``bytes`` payload to bytes for a single write path.

    Args:
        data: Content to write.
        encoding: Text encoding used when ``data`` is ``str``.
    """
    if isinstance(data, bytes):
        return data
    return data.encode(encoding)


def write_if_changed(
    path: Path,
    data: _Payload,
    *,
    encoding: str = "utf-8",
) -> bool:
    """Write ``data`` to ``path`` only when the bytes differ from the on-disk file.

    Creates parent directories as needed. When ``path`` already exists and its
    bytes match the freshly encoded payload, the call is a no-op — the file's
    mtime is preserved so IDEs and file watchers stay quiet.

    Args:
        path: Destination file.
        data: New content — ``str`` (encoded with ``encoding``) or raw ``bytes``.
        encoding: Text encoding used to convert ``str`` inputs; ignored for bytes.

    Returns:
        ``True`` when a write actually happened, ``False`` when the file was
        already byte-identical.
    """
    new_bytes = _to_bytes(data, encoding=encoding)
    if path.is_file():
        try:
            if path.read_bytes() == new_bytes:
                return False
        except OSError:
            pass
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(new_bytes)
    return True
