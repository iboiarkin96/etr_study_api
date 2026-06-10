"""Baseline accessibility validation for docs HTML pages (UI Kit v2)."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

import html5lib

ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = ROOT / "services" / "portal"
ASSETS_ROOT = ROOT / "services" / "frontend" / "portal"

# UI Kit v2 token files. Per-portal accent lives in `_portal-<id>.css`.
KIT_TOKENS_ROOT = ASSETS_ROOT / "assets_v2" / "ui-kit" / "tokens"
THEME_LIGHT_CSS = KIT_TOKENS_ROOT / "_theme-light.css"
THEME_DARK_CSS = KIT_TOKENS_ROOT / "_theme-dark.css"
PORTAL_INTERNAL_CSS = KIT_TOKENS_ROOT / "_portal-internal.css"
PORTAL_PUBLIC_CSS = KIT_TOKENS_ROOT / "_portal-public.css"
# Shared focus-ring/component styles live in components/*.css. Probe the
# topbar (visible focus required on theme-toggle / search input).
TOPBAR_CSS = ASSETS_ROOT / "assets_v2" / "ui-kit" / "components" / "topbar.css"

FROZEN_DOCS_REL_PATHS = {
    # Portal router landings — selector layouts with stylized headings that
    # don't follow the docs heading hierarchy.
    Path("index.html"),
    Path("internal/index.html"),
    Path("internal/team/people/ivan-boyarkin/sa-growth.html"),
    Path("internal/team/people/ivan-boyarkin/week-calendar-2026-05-07.html"),
}


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _tracked_html_paths() -> set[Path] | None:
    """Return absolute paths of git-tracked HTML files under docs.

    Returns None when git is unavailable (e.g. tarball builds), in which case
    the caller falls back to scanning the filesystem unfiltered.
    """
    try:
        output = subprocess.check_output(
            ["git", "ls-files", "-z", "--", "services/portal"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return {ROOT / rel for rel in output.decode().split("\0") if rel.endswith(".html")}


def _iter_docs_pages() -> list[Path]:
    tracked = _tracked_html_paths()
    pages: list[Path] = []
    for path in sorted(DOCS_ROOT.glob("**/*.html")):
        rel = path.relative_to(DOCS_ROOT)
        if rel.parts and rel.parts[0] in {"api", "assets", "pdoc"}:
            continue
        # pdoc-generated tree at internal/services/api/code-reference/ is owned
        # by `python -m pdoc`; nothing else writes
        # there and a11y issues in pdoc HTML can't be hand-fixed.
        if "code-reference" in rel.parts:
            continue
        if rel in FROZEN_DOCS_REL_PATHS:
            continue
        if tracked is not None and path not in tracked:
            continue
        pages.append(path)
    return pages


def _is_redirect_stub(root_el, text: str) -> bool:
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        if _local_name(node.tag) != "meta":
            continue
        equiv = (node.attrib.get("http-equiv") or "").lower()
        if equiv == "refresh":
            return True
    lowered = text.lower()
    if "window.location.replace(" in lowered and 'rel="canonical"' in lowered:
        return True
    if "<title>moved" in lowered:
        return True
    return False


def _extract_headings(root_el) -> list[int]:
    levels: list[int] = []
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        name = _local_name(node.tag)
        if len(name) == 2 and name.startswith("h") and name[1].isdigit():
            levels.append(int(name[1]))
    return levels


def _find_landmarks(root_el) -> tuple[bool, bool]:
    has_main = False
    has_landmark = False
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        name = _local_name(node.tag)
        if name == "main":
            has_main = True
        elif name in {"nav", "header", "footer", "aside"}:
            has_landmark = True
    return has_main, has_landmark


def _is_natively_interactive(name: str) -> bool:
    return name in {"a", "button", "input", "select", "textarea", "summary"}


def _check_keyboard(root_el) -> list[str]:
    errors: list[str] = []
    for node in root_el.iter():
        if not isinstance(node.tag, str):
            continue
        name = _local_name(node.tag)
        tabindex = node.attrib.get("tabindex")
        if tabindex:
            try:
                if int(tabindex) > 0:
                    errors.append(f"positive tabindex on <{name}>")
            except ValueError:
                errors.append(f"invalid tabindex='{tabindex}' on <{name}>")

        if "onclick" in node.attrib and not _is_natively_interactive(name):
            if not any(key in node.attrib for key in ("onkeydown", "onkeyup", "onkeypress")):
                errors.append(f"onclick without keyboard handler on <{name}>")
    return errors


def _hex_to_rgb(value: str) -> tuple[int, int, int] | None:
    v = value.strip().lower()
    if not v.startswith("#"):
        return None
    v = v[1:]
    if len(v) == 3:
        v = "".join(ch * 2 for ch in v)
    if len(v) != 6 or any(ch not in "0123456789abcdef" for ch in v):
        return None
    r = int(v[0:2], 16)
    g = int(v[2:4], 16)
    b = int(v[4:6], 16)
    return (r, g, b)


def _relative_luminance(rgb: tuple[int, int, int]) -> float:
    def channel(c: int) -> float:
        s = c / 255.0
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def _contrast_ratio(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    l1 = _relative_luminance(a)
    l2 = _relative_luminance(b)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def _extract_css_vars(css_text: str, skip_dark: bool = True) -> dict[str, str]:
    """Extract ``--token: value`` declarations from a CSS file.

    When ``skip_dark`` is true (default) the contents of any rule whose
    selector contains ``[data-theme="dark"]`` are ignored. This matters for
    files that define both light and dark variants of the same token under
    selectors like ``html[data-portal="…"][data-theme="dark"]`` — the
    contrast check is meant to apply to the light defaults.
    """
    vars_found: dict[str, str] = {}
    # Walk top-level rules: selector { … }
    pos = 0
    depth = 0
    block_start = 0
    selector_buf: list[str] = []
    selector = ""
    while pos < len(css_text):
        ch = css_text[pos]
        if ch == "{" and depth == 0:
            selector = "".join(selector_buf).strip()
            selector_buf = []
            block_start = pos + 1
            depth = 1
            pos += 1
            continue
        if ch == "{" and depth > 0:
            depth += 1
            pos += 1
            continue
        if ch == "}" and depth > 0:
            depth -= 1
            if depth == 0:
                block = css_text[block_start:pos]
                if not (skip_dark and 'data-theme="dark"' in selector):
                    for name, value in re.findall(r"(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);", block):
                        vars_found[name] = value.strip()
                selector_buf = []
                selector = ""
            pos += 1
            continue
        if depth == 0:
            selector_buf.append(ch)
        pos += 1
    return vars_found


def _check_css_baseline() -> list[str]:
    """Validate the v2 design-tokens baseline.

    Reads the UI Kit v2 token files directly (not legacy ``docs.css``) and
    checks:
        - every required neutral token is defined in ``_theme-light.css``
        - per-portal accents are defined in ``_portal-{internal,public}.css``
        - text/background pairs meet WCAG AA contrast (4.5:1)
        - at least one component CSS defines ``:focus`` / ``:focus-visible``
    """
    errors: list[str] = []

    for css_path in (THEME_LIGHT_CSS, PORTAL_INTERNAL_CSS, PORTAL_PUBLIC_CSS):
        if not css_path.exists():
            errors.append(f"missing required token file {css_path.relative_to(ROOT)}")
    if errors:
        return errors

    light_vars = _extract_css_vars(THEME_LIGHT_CSS.read_text(encoding="utf-8"))
    internal_accent = _extract_css_vars(PORTAL_INTERNAL_CSS.read_text(encoding="utf-8"))
    public_accent = _extract_css_vars(PORTAL_PUBLIC_CSS.read_text(encoding="utf-8"))

    required_neutrals = ["--bg", "--card", "--text", "--muted", "--line"]
    for var_name in required_neutrals:
        if var_name not in light_vars:
            errors.append(f"missing token {var_name} in {THEME_LIGHT_CSS.relative_to(ROOT)}")

    for accent_vars, label in (
        (internal_accent, PORTAL_INTERNAL_CSS.relative_to(ROOT)),
        (public_accent, PORTAL_PUBLIC_CSS.relative_to(ROOT)),
    ):
        if "--accent" not in accent_vars:
            errors.append(f"missing token --accent in {label}")

    pairs = [
        ("--text", "--bg", 4.5),
        ("--text", "--card", 4.5),
        ("--muted", "--bg", 4.5),
    ]
    for fg_name, bg_name, min_ratio in pairs:
        fg = _hex_to_rgb(light_vars.get(fg_name, ""))
        bg = _hex_to_rgb(light_vars.get(bg_name, ""))
        if fg is None or bg is None:
            errors.append(f"cannot compute contrast for {fg_name} vs {bg_name}")
            continue
        ratio = _contrast_ratio(fg, bg)
        if ratio < min_ratio:
            errors.append(f"contrast {fg_name}/{bg_name}={ratio:.2f} is below {min_ratio:.1f}")

    # Accent buttons / pills paint --text-on-accent on top of --accent.
    # WCAG 3:1 ("AA Large" + non-text UI components) is the floor — kit
    # accents are used at ≥14pt bold or as solid UI fills where the
    # large-text threshold applies.
    text_on_accent = _hex_to_rgb(light_vars.get("--text-on-accent", ""))
    for accent_vars, portal_label in (
        (internal_accent, "internal"),
        (public_accent, "public"),
    ):
        accent_hex = _hex_to_rgb(accent_vars.get("--accent", ""))
        if accent_hex is None or text_on_accent is None:
            errors.append(f"cannot compute --accent ({portal_label}) vs --text-on-accent contrast")
            continue
        ratio = _contrast_ratio(accent_hex, text_on_accent)
        if ratio < 3.0:
            errors.append(
                f"accent ({portal_label}) vs --text-on-accent contrast={ratio:.2f} "
                f"is below 3.0 (AA large / UI components)"
            )

    # Focus styles live in the kit's shared component CSS; require at least
    # one ``:focus``/``:focus-visible`` selector somewhere under components/.
    components_root = ASSETS_ROOT / "assets_v2" / "ui-kit" / "components"
    found_focus = False
    if components_root.exists():
        for css_path in components_root.glob("*.css"):
            css_text = css_path.read_text(encoding="utf-8")
            if ":focus-visible" in css_text or ":focus" in css_text:
                found_focus = True
                break
    if not found_focus:
        errors.append(
            "no :focus / :focus-visible selectors found in assets_v2/ui-kit/components/*.css"
        )

    return errors


def main() -> None:
    parser = html5lib.HTMLParser(tree=html5lib.getTreeBuilder("etree"))
    failures: list[str] = []

    failures.extend(_check_css_baseline())

    for path in _iter_docs_pages():
        rel = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        doc = parser.parse(text)
        if parser.errors:
            failures.append(f"{rel}: HTML5 parse errors ({len(parser.errors)})")
            parser.errors.clear()
            continue

        redirect_stub = _is_redirect_stub(doc, text)
        headings = _extract_headings(doc)
        has_main, has_landmark = _find_landmarks(doc)

        if not redirect_stub:
            if not headings:
                failures.append(f"{rel}: no headings found")
            else:
                if headings.count(1) != 1:
                    failures.append(f"{rel}: expected exactly one h1, found {headings.count(1)}")
                prev = headings[0]
                for level in headings[1:]:
                    if level - prev > 1:
                        failures.append(f"{rel}: heading jump h{prev}->h{level}")
                        break
                    prev = level

            if not has_main:
                failures.append(f"{rel}: missing <main> landmark")
            if not has_landmark:
                failures.append(
                    f"{rel}: missing navigation landmark (<nav>, <header>, <footer>, or <aside>)"
                )

        kb_errors = _check_keyboard(doc)
        for err in kb_errors:
            failures.append(f"{rel}: {err}")

    if failures:
        print("Docs A11y baseline check failed:")
        for item in failures:
            print(f" - {item}")
        raise SystemExit(1)

    print("Docs A11y baseline check passed")


if __name__ == "__main__":
    main()
