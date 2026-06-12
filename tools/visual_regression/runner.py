"""Visual-regression runner for the UI Kit showcase (BL-047).

Headless-Chromium screenshots of `services/portal/ui-kit/pages/templates/*.html`
in three frames (desktop-light / desktop-dark / mobile-light), pixel-diff'd
against PNG baselines in `tests/visual/baselines/`.

Used by both `pytest tests/visual/` and `make visual-test` (CLI). The CLI is
the entry point committed UI Kit edits run through; pytest is the same
comparison wrapped as a parametrised test for CI traceability.

Modes:
  check   — sweep every (page, viewport) pair, write actuals + red-overlay
            diffs to `tests/visual/_artifacts/` on any mismatch > 0.1%.
            Non-zero exit on any mismatch.
  update  — overwrite baselines from the current render. Run after an
            intentional UI edit; commit the new PNGs alongside the change.

The non-determinism budget — Math.random / Date.now seeding, font-ready
gate, animation kill-switch, canvas hide — is applied as init-script +
add_style_tag injections, so the kit itself stays untouched.
"""

from __future__ import annotations

import argparse
import contextlib
import http.server
import json
import os
import socket
import socketserver
import sys
import threading
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PORTAL_SERVE_ROOT = ROOT / "services"
PAGES_JSON = ROOT / "tests" / "visual" / "pages.json"
BASELINES_DIR = ROOT / "tests" / "visual" / "baselines"
ARTIFACTS_DIR = ROOT / "tests" / "visual" / "_artifacts"
ACTUAL_DIR = ARTIFACTS_DIR / "actual"
DIFFS_DIR = ARTIFACTS_DIR / "diffs"

DIFF_THRESHOLD = 0.001  # 0.1%
# ignore per-channel deltas this small (anti-alias buffer)
CHANNEL_TOLERANCE = 4

# ANSI colour palette — honours the NO_COLOR convention so CI/log piping can
# disable it without code changes (set NO_COLOR=1). Otherwise on by default
# because most CI viewers (GitHub Actions, GitLab) render ANSI fine.
_COLOR = not os.environ.get("NO_COLOR")
_C_RED = "\033[31m" if _COLOR else ""
_C_GREEN = "\033[32m" if _COLOR else ""
_C_YELLOW = "\033[33m" if _COLOR else ""
_C_DIM = "\033[2m" if _COLOR else ""
_C_BOLD = "\033[1m" if _COLOR else ""
_C_RESET = "\033[0m" if _COLOR else ""

VIEWPORTS = {
    "desktop-light": {"width": 1280, "height": 800, "theme": "light", "mobile": False},
    "desktop-dark": {"width": 1280, "height": 800, "theme": "dark", "mobile": False},
    "mobile-light": {"width": 390, "height": 844, "theme": "light", "mobile": True},
}

# Injected into every page before navigation. Freezes Math.random + Date.now,
# seeds the theme preference so the no-flash bootstrap script picks it up
# before first paint. Keep this in sync with the bootstrap in each template
# (localStorage key `docs-theme-preference`).
INIT_SCRIPT_TPL = """
(() => {
  // Deterministic LCG — neutralises text-decrypt randomness.
  let _s = 1337;
  Math.random = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
  // Freeze time — neutralises live-tickers / rocket / any rAF-driven anim.
  const _frozen = 1717200000000; // 2024-06-01T00:00:00Z, deterministic
  const _RealDate = Date;
  Date = class extends _RealDate {
    constructor(...args) { return args.length ? new _RealDate(...args) : new _RealDate(_frozen); }
    static now() { return _frozen; }
  };
  try { localStorage.setItem("docs-theme-preference", "__THEME__"); } catch (e) {}
})();
"""

# Injected as a <style> tag after page load. Kills animations and transitions,
# hides hero canvases that would otherwise leak WebGL noise into the snapshot.
NEUTRALIZE_CSS = """
*, *::before, *::after {
  animation: none !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition: none !important;
  caret-color: transparent !important;
}
html { scroll-behavior: auto !important; }
.lp-hero__canvas, [data-hero-canvas], canvas { visibility: hidden !important; }
[data-component="rocket"] { display: none !important; }
"""


@dataclass
class DiffResult:
    """Outcome of a single (baseline, actual) comparison."""

    page: str
    viewport: str
    ratio: float  # fraction of differing pixels [0..1]; 1.0 on size mismatch
    baseline_path: Path
    actual_path: Path
    diff_path: Path | None  # set only when diff PNG was written

    @property
    def passed(self) -> bool:
        return self.ratio <= DIFF_THRESHOLD


def _format_id(template: str, path: Path) -> str:
    """Resolve {stem}/{parent}/{grandparent}/… placeholders against a file path."""
    return template.format(
        stem=path.stem,
        name=path.name,
        parent=path.parent.name,
        grandparent=path.parent.parent.name,
        great_grandparent=path.parent.parent.parent.name,
    )


def _load_pages() -> list[dict]:
    """Build the page corpus from `tests/visual/pages.json`.

    Two source shapes supported in the same file:

      "pages": [ { "id": "...", "path": "..." }, ... ]
        Hand-curated explicit entries. Use for one-off specimens (templates).

      "rules": [
        {
          "id_format": "runbook-{grandparent}-{stem}",
          "glob": "portal/internal/**/runbooks/*.html",
          "exclude": ["**/index.html"]
        }, ...
      ]
        Glob-driven discovery. Use for whole families (every live runbook,
        every doc-page under a quadrant, …). New files added to disk are
        picked up automatically on the next run.

    Both lists merge. IDs must be unique across the merged list; duplicates
    crash early.
    """
    if not PAGES_JSON.exists():
        raise SystemExit(f"corpus file missing: {PAGES_JSON}")
    data = json.loads(PAGES_JSON.read_text("utf-8"))

    pages: list[dict] = list(data.get("pages") or [])
    seen: set[str] = {p["id"] for p in pages}

    for rule in data.get("rules") or []:
        template = rule["id_format"]
        pattern = rule["glob"]
        excludes = rule.get("exclude") or []
        for fs_path in sorted(PORTAL_SERVE_ROOT.glob(pattern)):
            if any(fs_path.match(ex) for ex in excludes):
                continue
            page_id = _format_id(template, fs_path)
            if page_id in seen:
                raise SystemExit(
                    f"duplicate corpus id {page_id!r} (from rule glob={pattern!r}, path={fs_path})"
                )
            seen.add(page_id)
            pages.append({"id": page_id, "path": str(fs_path.relative_to(PORTAL_SERVE_ROOT))})

    if not pages:
        raise SystemExit(f"corpus is empty — add `pages` or `rules` to {PAGES_JSON.name}")
    return pages


def _baseline_name(page_id: str, viewport: str) -> str:
    return f"{page_id}__{viewport}.png"


def _detect_orphan_baselines(pages: list[dict]) -> list[Path]:
    """PNGs in baselines/ that no longer correspond to a corpus page.

    Surfaces deleted-but-not-cleaned-up baselines so the file tree doesn't
    silently rot. Sibling concern to `MISSING baseline` for new pages.
    """
    if not BASELINES_DIR.exists():
        return []
    expected = {_baseline_name(p["id"], v) for p in pages for v in VIEWPORTS}
    return sorted(png for png in BASELINES_DIR.glob("*.png") if png.name not in expected)


@contextlib.contextmanager
def _serve_portal(port: int) -> Iterator[str]:
    """Spawn a quiet http.server rooted at services/ and yield the base URL.

    Same geometry as `make -C services/portal serve`: relative asset refs in
    UI Kit pages (`../../../../frontend/...`) resolve correctly.
    """

    serve_root = str(PORTAL_SERVE_ROOT)

    class _Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            # `directory` MUST go through the constructor — setting it as a
            # class attribute on SimpleHTTPRequestHandler is a silent no-op
            # on Python 3.10+ and every request 404s into the default error
            # page (the source of the «all-screens show Error response» bug).
            super().__init__(*args, directory=serve_root, **kwargs)

        def log_message(self, *_a, **_kw):
            pass

    class _Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    srv = _Server(("127.0.0.1", port), _Handler)
    thread = threading.Thread(target=srv.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        srv.shutdown()
        srv.server_close()


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_ready(base_url: str, timeout: float = 5.0) -> None:
    import urllib.error
    import urllib.request

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{base_url}/", timeout=0.5):
                return
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.05)
    raise RuntimeError(f"portal http server did not become ready at {base_url}")


def _capture(browser, base_url: str, page_id: str, page_path: str, viewport: str) -> bytes:
    """Render one (page, viewport) tuple and return PNG bytes.

    `browser` is a long-lived `playwright.chromium.Browser`. Each call spins
    up a fresh context (cheap, ~50 ms) instead of a full browser launch
    (~500 ms). With one browser shared across all tiles, the total launch
    cost drops from N×500ms to a single ×500ms.
    """
    conf = VIEWPORTS[viewport]
    url = f"{base_url}/{page_path}"
    context_kwargs: dict = {
        "viewport": {"width": conf["width"], "height": conf["height"]},
        "device_scale_factor": 3 if conf["mobile"] else 1,
        "reduced_motion": "reduce",
        "color_scheme": conf["theme"],
    }
    if conf["mobile"]:
        context_kwargs["is_mobile"] = True
        context_kwargs["has_touch"] = True

    context = browser.new_context(**context_kwargs)
    try:
        context.add_init_script(INIT_SCRIPT_TPL.replace("__THEME__", str(conf["theme"])))
        page = context.new_page()
        page.goto(url, wait_until="networkidle", timeout=15_000)
        page.add_style_tag(content=NEUTRALIZE_CSS)
        page.evaluate("document.fonts && document.fonts.ready")
        # Settle one rAF tick so any sync mount work commits before snapshot.
        page.evaluate("new Promise(r => requestAnimationFrame(() => r(null)))")
        return page.screenshot(full_page=True, animations="disabled", caret="hide")
    finally:
        context.close()


def compare(baseline_path: Path, actual_path: Path) -> tuple[float, bytes | None]:
    """Compare two PNGs pixel-by-pixel.

    Returns `(ratio, diff_png_bytes)`. `diff_png_bytes` is None when the
    images match within tolerance; otherwise it's a red-tint overlay on
    the baseline marking changed pixels.
    """
    from PIL import Image, ImageChops

    base = Image.open(baseline_path).convert("RGB")
    actual = Image.open(actual_path).convert("RGB")
    if base.size != actual.size:
        return 1.0, _size_mismatch_png(base, actual)

    delta = ImageChops.difference(base, actual)
    # max-channel-delta per pixel → grayscale; threshold counts > CHANNEL_TOLERANCE.
    mask = delta.point(lambda v: 255 if v > CHANNEL_TOLERANCE else 0).convert("L")
    # Pillow's Image.getbbox returns None if mask all-zero — quick win path.
    bbox = mask.getbbox()
    if bbox is None:
        return 0.0, None

    changed = sum(1 for px in mask.getdata() if px > 0)
    total = base.size[0] * base.size[1]
    ratio = changed / total

    if ratio <= DIFF_THRESHOLD:
        return ratio, None

    # Red-tint overlay: take baseline, blend a pure-red layer through `mask`.
    red = Image.new("RGB", base.size, (255, 0, 0))
    diff = Image.composite(red, base, mask)
    import io

    buf = io.BytesIO()
    diff.save(buf, format="PNG")
    return ratio, buf.getvalue()


def _size_mismatch_png(base, actual):
    """Render a stacked side-by-side that makes the dim mismatch obvious."""
    from PIL import Image, ImageDraw

    w = max(base.width, actual.width)
    h = base.height + actual.height + 20
    out = Image.new("RGB", (w, h), (40, 40, 40))
    out.paste(base, (0, 0))
    out.paste(actual, (0, base.height + 20))
    d = ImageDraw.Draw(out)
    d.text(
        (6, base.height + 4), f"baseline {base.size}  vs  actual {actual.size}", fill=(255, 80, 80)
    )
    import io

    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def _ensure_dirs() -> None:
    """Make sure the baselines + _artifacts tree exists; wipe stale run artifacts.

    `_artifacts/actual/` and `_artifacts/diffs/` are recreated empty on every
    invocation — otherwise a previous failure's PNG would linger across runs
    and a reader (or CI artifact upload) couldn't tell which fail it belongs
    to. Baselines are never touched here — those are committed state.
    """
    import shutil

    BASELINES_DIR.mkdir(parents=True, exist_ok=True)
    for path in (ACTUAL_DIR, DIFFS_DIR):
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True)


_thread_pw = threading.local()
_print_lock = threading.Lock()


def _thread_browser():
    """Lazy per-thread Playwright instance + Chromium browser.

    The Python sync API marshals every call through one internal worker
    thread, so sharing a single `sync_playwright` across our ThreadPool
    would serialize everything. Giving each worker its own driver
    subprocess + Chromium = real parallelism.

    Cost: ~500 ms launch + ~500 MB RAM per thread. Default workers=4
    keeps ~2 GB RAM, ~4× wall-clock speedup. Override with `--workers`.
    """
    if not hasattr(_thread_pw, "browser"):
        from playwright.sync_api import sync_playwright

        _thread_pw._cm = sync_playwright()
        _thread_pw.pw = _thread_pw._cm.start()
        _thread_pw.browser = _thread_pw.pw.chromium.launch()
    return _thread_pw.browser


def _thread_teardown():
    """Stop this thread's driver subprocess on shutdown."""
    if hasattr(_thread_pw, "browser"):
        try:
            _thread_pw.browser.close()
            _thread_pw._cm.__exit__(None, None, None)
        except Exception:
            pass
        for attr in ("browser", "pw", "_cm"):
            if hasattr(_thread_pw, attr):
                delattr(_thread_pw, attr)


@dataclass
class _TileResult:
    page_id: str
    viewport: str
    status: str  # "ok" | "fail" | "missing" | "updated"
    ratio: float
    baseline_path: Path
    actual_path: Path
    diff_path: Path | None
    name: str


def _process_tile(base_url: str, page: dict, viewport: str, mode: str) -> _TileResult:
    """Capture a single tile and (in `check` mode) diff it. Thread-safe."""
    name = _baseline_name(page["id"], viewport)
    actual_path = ACTUAL_DIR / name
    baseline_path = BASELINES_DIR / name

    browser = _thread_browser()
    png = _capture(browser, base_url, page["id"], page["path"], viewport)
    actual_path.write_bytes(png)

    if mode == "update":
        baseline_path.write_bytes(png)
        return _TileResult(
            page["id"],
            viewport,
            "updated",
            0.0,
            baseline_path,
            actual_path,
            None,
            name,
        )

    if not baseline_path.exists():
        return _TileResult(
            page["id"],
            viewport,
            "missing",
            1.0,
            baseline_path,
            actual_path,
            None,
            name,
        )

    ratio, diff_png = compare(baseline_path, actual_path)
    if diff_png is None:
        return _TileResult(
            page["id"],
            viewport,
            "ok",
            ratio,
            baseline_path,
            actual_path,
            None,
            name,
        )

    diff_path = DIFFS_DIR / name
    diff_path.write_bytes(diff_png)
    return _TileResult(
        page["id"],
        viewport,
        "fail",
        ratio,
        baseline_path,
        actual_path,
        diff_path,
        name,
    )


def _print_tile(r: _TileResult) -> None:
    """Render one tile result line. Locked so threads don't interleave."""
    with _print_lock:
        if r.status == "updated":
            print(f"  {_C_DIM}baseline ↻{_C_RESET} {r.name}")
        elif r.status == "missing":
            print(
                f"  {_C_YELLOW}{_C_BOLD}MISSING{_C_RESET} "
                f"baseline: {r.name} "
                f"{_C_DIM}(run `make visual-test-update` first){_C_RESET}"
            )
        elif r.status == "ok":
            print(
                f"  {_C_GREEN}ok      {_C_RESET} {r.name}  {_C_DIM}({r.ratio * 100:.3f}%){_C_RESET}"
            )
        elif r.status == "fail":
            print(
                f"  {_C_RED}{_C_BOLD}FAIL    {_C_RESET} {r.name}  "
                f"{_C_RED}({r.ratio * 100:.3f}% > {DIFF_THRESHOLD * 100:.1f}%){_C_RESET}"
            )


def run(
    mode: str,
    only: str | None = None,
    port: int | None = None,
    workers: int = 4,
) -> int:
    """Sweep every (page, viewport) tuple and report.

    `mode='check'` returns 0 only if all comparisons pass.
    `mode='update'` overwrites baselines from the current render — used after
    an intentional UI edit (see tests/visual/README.md for the recipe).

    `workers` — number of parallel Chromium browsers (each in its own thread).
    """
    pages = _load_pages()
    if only:
        pages = [p for p in pages if only in p["id"] or only in p["path"]]
        if not pages:
            print(f"no pages matched filter: {only}", file=sys.stderr)
            return 2

    _ensure_dirs()
    port = port or _free_port()

    tasks = [(page, viewport) for page in pages for viewport in VIEWPORTS]
    workers = max(1, min(workers, len(tasks)))

    failures: list[DiffResult] = []
    with _serve_portal(port) as base_url:
        _wait_ready(base_url)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(_process_tile, base_url, page, viewport, mode): (page["id"], viewport)
                for page, viewport in tasks
            }
            try:
                for fut in as_completed(futures):
                    result = fut.result()
                    _print_tile(result)
                    if result.status in ("fail", "missing"):
                        failures.append(
                            DiffResult(
                                result.page_id,
                                result.viewport,
                                result.ratio,
                                result.baseline_path,
                                result.actual_path,
                                result.diff_path,
                            )
                        )
            finally:
                # Tear down per-thread browsers. ThreadPoolExecutor doesn't
                # surface workers, so submit a teardown task per worker and
                # wait. Best-effort: leaked drivers die with the process.
                teardown = [pool.submit(_thread_teardown) for _ in range(workers)]
                for t in teardown:
                    try:
                        t.result(timeout=5)
                    except Exception:
                        pass

    if mode == "update":
        # Orphan cleanup: only safe on a full-corpus run. With `--only X`
        # the page list is intentionally truncated, so every NOT-X baseline
        # would falsely look orphan-ed and get nuked.
        orphans = [] if only else _detect_orphan_baselines(pages)
        for png in orphans:
            png.unlink()
            print(
                f"  {_C_YELLOW}orphan ✗{_C_RESET} {png.name} "
                f"{_C_DIM}(page no longer in corpus){_C_RESET}"
            )
        print(
            f"\n{_C_GREEN}✓ refreshed {len(pages) * len(VIEWPORTS)} baselines"
            f"{f' (removed {len(orphans)} orphan(s))' if orphans else ''}"
            f" under {BASELINES_DIR.relative_to(ROOT)}{_C_RESET}"
        )
        return 0

    # Orphan-baseline drift in check mode — file deleted but PNG lingers.
    # Filtered runs (--only X) skip this; otherwise it would false-positive.
    if not only:
        orphans = _detect_orphan_baselines(pages)
        for png in orphans:
            print(
                f"  {_C_RED}{_C_BOLD}ORPHAN  {_C_RESET} {png.name} "
                f"{_C_DIM}(no page; delete or restore){_C_RESET}"
            )
        if orphans:
            failures.extend(DiffResult(png.stem, "", 1.0, png, png, None) for png in orphans)

    if failures:
        print(
            f"\n{_C_RED}{_C_BOLD}✗ {len(failures)} visual regression(s).{_C_RESET} "
            f"{_C_DIM}See {ARTIFACTS_DIR.relative_to(ROOT)}/{_C_RESET}"
        )
        return 1

    print(f"\n{_C_GREEN}{_C_BOLD}✓ {len(pages) * len(VIEWPORTS)} comparisons passed{_C_RESET}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="visual_regression", description=__doc__)
    parser.add_argument("--mode", choices=["check", "update"], default="check")
    parser.add_argument(
        "--only",
        help="substring filter on page id or path (e.g. 'doc-howto')",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="static-server port (default: free ephemeral port)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=int(os.environ.get("VISUAL_TEST_WORKERS", "4")),
        help="parallel Chromium browsers (default: 4; env: VISUAL_TEST_WORKERS)",
    )
    args = parser.parse_args(argv)
    return run(mode=args.mode, only=args.only, port=args.port, workers=args.workers)


if __name__ == "__main__":
    sys.exit(main())
