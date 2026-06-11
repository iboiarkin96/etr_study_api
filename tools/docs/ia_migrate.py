#!/usr/bin/env python3
"""IA migration engine for services/portal/internal/.

Modes
-----
--plan        Walk internal/ and emit CSV manifest (old_path, new_path, commit, merge_target, notes).
--apply       Read manifest CSV; perform git mv + href rewrite + relative-path recalc + breadcrumbs.
--dry-run     With --apply, log what would change without touching the working tree.

The mapping rules are derived from the approved Diátaxis migration plan
(/Users/ivan_boyarkin/.claude/plans/ethereal-fluttering-dewdrop.md).
Manifest committed at governance/audit/2026-05-16-ia-migration-manifest.md.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import subprocess
import sys
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from posixpath import normpath as posix_normpath

REPO_ROOT = Path(__file__).resolve().parents[2]
INTERNAL = Path("services/portal/internal")


@dataclass(frozen=True)
class Mapping:
    old: str
    new: str
    commit: int
    merge_target: str = ""
    notes: str = ""


# ---------------------------------------------------------------------------
# Rule table — every mapping is a deterministic function of the old path.
# Commit numbers follow Phase 1 ordering from the plan.
# ---------------------------------------------------------------------------


def map_path(rel: str) -> Mapping | None:
    """Return Mapping for an internal/-relative file path, or None if unchanged."""

    # Top-level pass-throughs
    if rel == "index.html":
        return None  # rewritten in Commit 16 but stays at this path

    parts = rel.split("/")
    top = parts[0]

    # ---- Commit 1: uml/* -> handbook/uml/* ------------------------------
    if top == "uml":
        return Mapping(rel, f"handbook/uml/{'/'.join(parts[1:])}", 1)

    # ---- Commit 2: analysis -> 3 targets ---------------------------------
    if top == "analysis":
        if rel == "analysis/index.html":
            return Mapping(
                rel,
                "roles/sa.html",
                2,
                merge_target="roles/sa.html",
                notes="merge: index + practices radar",
            )
        if rel == "analysis/practices.html":
            return Mapping(
                rel,
                "roles/sa.html",
                2,
                merge_target="roles/sa.html",
                notes="merge into roles/sa.html (radar)",
            )
        if rel == "analysis/methodology.html":
            return Mapping(rel, "explanation/methodology.html", 2)
        if rel == "analysis/system-design.html":
            return Mapping(rel, "explanation/system-design.html", 2)
        if parts[1] == "practices" and len(parts) >= 3:
            return Mapping(rel, f"explanation/practices/sa/{'/'.join(parts[2:])}", 2)

    # ---- Commit 3: sre/* -> 5 targets ------------------------------------
    if top == "sre":
        if rel == "sre/index.html":
            return Mapping(rel, "roles/sre.html", 3, merge_target="roles/sre.html")
        if rel == "sre/practices.html":
            return Mapping(
                rel,
                "roles/sre.html",
                3,
                merge_target="roles/sre.html",
                notes="merge into roles/sre.html (radar)",
            )
        if parts[1] == "practices" and len(parts) >= 3:
            return Mapping(rel, f"explanation/practices/sre/{'/'.join(parts[2:])}", 3)
        if parts[1] == "runbooks":
            return Mapping(rel, f"how-to/runbooks/{'/'.join(parts[2:])}", 3)
        if parts[1] == "postmortems":
            return Mapping(rel, f"how-to/postmortems/{'/'.join(parts[2:])}", 3)
        # SRE foundations -> handbook/sre/*
        if len(parts) == 2 and rel.endswith(".html"):
            return Mapping(rel, f"handbook/sre/{parts[1]}", 3)

    # ---- Commit 4: architect ---------------------------------------------
    if top == "architect":
        if rel in ("architect/index.html", "architect/practices.html"):
            return Mapping(
                rel,
                "roles/architect.html",
                4,
                merge_target="roles/architect.html",
                notes="merge index + practices radar",
            )
        if parts[1] == "practices" and len(parts) >= 3:
            return Mapping(rel, f"explanation/practices/architect/{'/'.join(parts[2:])}", 4)

    # ---- Commit 5: dev ---------------------------------------------------
    if top == "dev":
        if rel in ("dev/index.html", "dev/practices.html"):
            return Mapping(
                rel,
                "roles/dev.html",
                5,
                merge_target="roles/dev.html",
                notes="merge index + practices radar (Commit 5)",
            )
        if parts[1] == "practices" and len(parts) >= 3:
            return Mapping(rel, f"explanation/practices/dev/{'/'.join(parts[2:])}", 5)

    # ---- Commit 6: manager -----------------------------------------------
    if top == "manager":
        if rel in ("manager/index.html", "manager/practices.html"):
            return Mapping(
                rel,
                "roles/manager.html",
                6,
                merge_target="roles/manager.html",
                notes="merge index + practices radar",
            )
        if rel == "manager/sdlc-raci-matrix.html":
            return Mapping(
                rel,
                "handbook/manager/sdlc-raci-matrix.html",
                6,
                notes="reference matrix; could be explanation/ — chose reference",
            )
        if parts[1] == "practices" and len(parts) >= 3:
            return Mapping(rel, f"explanation/practices/manager/{'/'.join(parts[2:])}", 6)

    # ---- Commit 7: handbook/qa -------------------------------------------
    if top == "handbook" and parts[1] == "qa":
        if rel == "handbook/qa/index.html":
            return Mapping(
                rel,
                "roles/qa.html",
                7,
                merge_target="roles/qa.html",
                notes="merge index + practices radar",
            )
        if rel == "handbook/qa/practices.html":
            return Mapping(
                rel,
                "roles/qa.html",
                7,
                merge_target="roles/qa.html",
                notes="merge into roles/qa.html (radar)",
            )
        if rel == "handbook/qa/tester-onboarding.html":
            return Mapping(rel, "tutorials/qa/onboarding.html", 7)
        if rel == "handbook/qa/glossary.html":
            return Mapping(rel, "handbook/qa/glossary.html", 7)
        if rel in (
            "handbook/qa/test-strategy.html",
            "handbook/qa/test-pyramid.html",
            "handbook/qa/qa-process.html",
        ):
            return Mapping(rel, f"handbook/qa/{parts[2]}", 7)
        if parts[2] == "playbooks":
            return Mapping(rel, f"how-to/qa/{'/'.join(parts[3:])}", 7)
        if parts[2] == "practices":
            return Mapping(rel, f"explanation/practices/qa/{'/'.join(parts[3:])}", 7)
        if parts[2] == "reference":
            return Mapping(rel, f"handbook/qa/{'/'.join(parts[3:])}", 7)
        if parts[2] == "templates":
            return Mapping(rel, f"handbook/qa/templates/{'/'.join(parts[3:])}", 7)
        # 0001-0005 checklists at handbook/qa root
        if re.match(r"^000\d-.*-checklist\.html$", parts[2] or ""):
            return Mapping(rel, f"handbook/qa/checklists/{parts[2]}", 7)

    # ---- Commit 8: handbook/developer ------------------------------------
    if top == "handbook" and parts[1] == "developer":
        name = parts[2]
        dev_explanation = {
            "0001-requirements.html": "handbook/swe/requirements.html",
            "0002-schemas-and-contracts.html": "handbook/swe/schemas-and-contracts.html",
            "0003-business-logic.html": "handbook/swe/business-logic.html",
        }
        if name in dev_explanation:
            return Mapping(rel, dev_explanation[name], 8)
        if name == "0005-error-matrix-by-status.html":
            return Mapping(rel, "reference/api/error-matrix-by-status.html", 8)
        if re.match(r"^00(0[6-9]|10)-.*\.html$", name or ""):
            short = re.sub(r"^\d+-", "", name)
            return Mapping(rel, f"how-to/dev/{short}", 8)
        if name == "index.html":
            return Mapping(
                rel,
                "roles/dev.html",
                8,
                merge_target="roles/dev.html",
                notes="merge into Commit 5 roles/dev.html",
            )

    # ---- Commit 9: handbook/howto + handbook/index -----------------------
    if top == "handbook" and parts[1] == "howto":
        name = parts[2]
        howto_map = {
            "0001-onboarding-from-zero-to-endpoint-docs.html": "tutorials/onboarding-zero-to-endpoint.html",
            "0002-internal-service-docs-layout.html": "handbook/sa/authoring/internal-service-docs-layout.html",
            "0003-make-commands-inventory.html": "how-to/docs/make-commands-inventory.html",
            "0004-how-to-add-post-contract.html": "how-to/api/add-post-contract.html",
            "0005-how-to-change-docs-frontend-safely.html": "how-to/docs/change-docs-frontend-safely.html",
            "index.html": "how-to/index.html",
        }
        if name in howto_map:
            return Mapping(
                rel,
                howto_map[name],
                9,
                notes="how-to/ index supersedes handbook/howto/index"
                if name == "index.html"
                else "",
            )

    if rel == "handbook/index.html":
        return Mapping(
            rel,
            "roles/index.html",
            9,
            notes="handbook root retired; roles/ becomes the curated entry",
        )

    # ---- Commit 10: front -> reference/front -----------------------------
    if top == "front":
        return Mapping(
            rel,
            f"reference/front/{'/'.join(parts[1:])}",
            10,
            notes="dedup with ui-kit deferred to Phase 4",
        )

    # ---- Commit 11: api -> reference/api + extras ------------------------
    if top == "api":
        if rel == "api/_shared/spec-definition-of-done.html":
            return Mapping(rel, "explanation/api/dod.html", 11)
        if rel == "api/_shared/spec-template.html":
            return Mapping(rel, "reference/templates/api-spec.html", 11)
        return Mapping(rel, f"reference/api/{'/'.join(parts[1:])}", 11)

    # ---- Commit 12: catalog -> services ----------------------------------
    if top == "catalog":
        return Mapping(
            rel,
            f"services/{'/'.join(parts[1:])}",
            12,
            notes="Makefile pdoc paths update in same commit",
        )

    # ---- Commit 13: governance audit template ----------------------------
    if rel == "governance/audit/AUDIT_TEMPLATE.html":
        return Mapping(rel, "reference/templates/audit.html", 13, notes="stub remains at old path")

    # team/, governance/ (the rest), and unmatched paths stay put
    return None


# ---------------------------------------------------------------------------
# Discovery + manifest writer
# ---------------------------------------------------------------------------


def iter_internal_html(root: Path) -> Iterable[Path]:
    base = root / INTERNAL
    for p in sorted(base.rglob("*.html")):
        yield p.relative_to(base)


def build_manifest(root: Path) -> list[Mapping]:
    out: list[Mapping] = []
    for relp in iter_internal_html(root):
        rel = str(relp).replace("\\", "/")
        m = map_path(rel)
        if m is not None:
            out.append(m)
    # uml/ non-HTML assets (whole directory rename in Commit 1)
    uml_dir = root / INTERNAL / "uml"
    if uml_dir.is_dir():
        for sub in sorted(uml_dir.rglob("*")):
            if not sub.is_file():
                continue
            if sub.suffix == ".html":
                continue
            rel = str(sub.relative_to(root / INTERNAL)).replace("\\", "/")
            out.append(Mapping(rel, f"reference/{rel}", 1, notes="non-HTML PlantUML asset"))
    return out


def write_csv(rows: Iterable[Mapping], dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with dest.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["commit", "old_path", "new_path", "merge_target", "notes"])
        for m in sorted(rows, key=lambda r: (r.commit, r.old)):
            writer.writerow([m.commit, m.old, m.new, m.merge_target, m.notes])
            n += 1
    return n


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def cmd_plan(args: argparse.Namespace) -> int:
    rows = build_manifest(REPO_ROOT)
    out = Path(args.out) if args.out else REPO_ROOT / "tmp" / "ia_manifest.csv"
    n = write_csv(rows, out)
    print(f"[plan] {n} entries written to {out}")
    by_commit: dict[int, int] = {}
    for r in rows:
        by_commit[r.commit] = by_commit.get(r.commit, 0) + 1
    for c in sorted(by_commit):
        print(f"  Commit {c:>2}: {by_commit[c]:>4} entries")
    return 0


# ---------------------------------------------------------------------------
# --apply: git mv + href / src rewrite + breadcrumb refresh
# ---------------------------------------------------------------------------


# Match href="..." or src="..." values. We deliberately limit rewrites to
# attribute contexts so that prose mentions inside <code> or <pre> stay intact.
_ATTR_RE = re.compile(
    r"""(?P<attr>\b(?:href|src|action|data-href|data-src))\s*=\s*(?P<q>['"])(?P<val>[^'"]+)(?P=q)""",
    re.IGNORECASE,
)


def load_manifest(path: Path, only_commit: int | None = None) -> list[Mapping]:
    rows: list[Mapping] = []
    with path.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            commit = int(row["commit"])
            if only_commit is not None and commit != only_commit:
                continue
            rows.append(
                Mapping(
                    old=row["old_path"],
                    new=row["new_path"],
                    commit=commit,
                    merge_target=row.get("merge_target", ""),
                    notes=row.get("notes", ""),
                )
            )
    return rows


def _internal_relative(href_target: str, page_dir: str) -> str | None:
    """Resolve an attribute value to an internal/-relative path, or None.

    Returns None for absolute URLs, anchors-only, mailto:, and external schemes.
    Strips the anchor/query for the lookup; callers re-attach.
    """
    if not href_target or href_target.startswith(
        ("http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:", "#")
    ):
        return None
    # Drop query/anchor for resolution
    bare = href_target.split("#", 1)[0].split("?", 1)[0]
    if not bare:
        return None
    if bare.startswith("/"):
        # Absolute path inside the site — make it portal-rooted if it points into internal/
        # We treat absolute paths as out-of-scope (likely public assets).
        return None
    joined = posix_normpath(f"{page_dir}/{bare}")
    return joined if not joined.startswith("..") else None


def _rebuild_attr(attr: str, quote: str, value: str) -> str:
    return f"{attr}={quote}{value}{quote}"


def _to_rel(from_dir: str, to_path: str) -> str:
    """Compute POSIX-style relative path from one internal/-relative dir to another file."""
    return os.path.relpath(to_path, start=from_dir or ".").replace("\\", "/")


def _resolve_internal(page_dir: str, bare: str) -> str | None:
    """Resolve a relative href to an internal/-rooted path, or None if external.

    Handles the legacy anti-pattern `../internal/...` (break out of internal/ and
    re-enter) by stripping the `../internal/` prefix after normalization.
    """
    joined = posix_normpath(f"{page_dir}/{bare}")
    if joined.startswith("../internal/"):
        return joined[len("../internal/") :]
    if joined.startswith(".."):
        return None
    return joined


def rewrite_html(text: str, page_old: str, page_new: str, mapping: dict[str, str]) -> str:
    """Rewrite href/src in a single HTML file's text.

    page_old: original internal/-relative path of this file (used to resolve old refs)
    page_new: target internal/-relative path of this file (used to compute new relative refs)
    mapping:  {old_internal_rel_path: new_internal_rel_path} for ALL files we're moving
    """
    old_dir = posix_normpath(os.path.dirname(page_old)) or "."
    new_dir = posix_normpath(os.path.dirname(page_new)) or "."

    def repl(m: re.Match) -> str:
        attr = m.group("attr")
        quote = m.group("q")
        val = m.group("val")

        # Split fragment/query
        bare = val
        suffix = ""
        for sep in ("?", "#"):
            idx = bare.find(sep)
            if idx >= 0:
                suffix = bare[idx:] + suffix
                bare = bare[:idx]
        if not bare or val.startswith(
            ("http://", "https://", "//", "mailto:", "tel:", "javascript:", "data:", "#")
        ):
            return m.group(0)
        if bare.startswith("/"):
            return m.group(0)

        # Resolve old-target as internal/-relative path (handles ../internal/ form)
        resolved_old = _resolve_internal(old_dir, bare)
        if resolved_old is None:
            # Path escapes internal/ (e.g. ../../../frontend/...). When the page
            # moves to a different depth we still need to adjust the leading ../
            # prefix. Recompute via portal-root-relative coordinates.
            if old_dir == new_dir:
                return m.group(0)
            INTERNAL_PREFIX = "services/portal/internal"
            abs_target = posix_normpath(f"{INTERNAL_PREFIX}/{old_dir}/{bare}")
            new_abs_dir = posix_normpath(f"{INTERNAL_PREFIX}/{new_dir}")
            try:
                new_rel = _to_rel(new_abs_dir, abs_target)
            except ValueError:
                return m.group(0)
            return _rebuild_attr(attr, quote, new_rel + suffix)

        # If the target is a directory ref ending with /, lookup index.html
        lookup = resolved_old
        if lookup.endswith("/"):
            lookup_candidate = posix_normpath(lookup + "index.html")
            new_target = mapping.get(lookup_candidate)
            if new_target:
                # Preserve trailing slash style: link to new dir
                new_dir_of_target = os.path.dirname(new_target).replace("\\", "/")
                new_rel = _to_rel(new_dir, new_dir_of_target) + "/"
                return _rebuild_attr(attr, quote, new_rel + suffix)
            return m.group(0)

        new_target = mapping.get(lookup)
        if new_target is None:
            # File didn't move — but THIS page may have moved, so we still need to
            # recompute the relative path from the new page location to the old target.
            if old_dir == new_dir:
                return m.group(0)
            new_rel = _to_rel(new_dir, resolved_old)
            return _rebuild_attr(attr, quote, new_rel + suffix)

        new_rel = _to_rel(new_dir, new_target)
        return _rebuild_attr(attr, quote, new_rel + suffix)

    return _ATTR_RE.sub(repl, text)


def make_redirect_stub(new_internal_rel: str, from_internal_rel: str) -> str:
    rel = _to_rel(os.path.dirname(from_internal_rel) or ".", new_internal_rel)
    return (
        "<!doctype html>\n"
        '<html lang="en">\n<head>\n'
        f'<meta http-equiv="refresh" content="0; url={rel}"/>\n'
        f'<link rel="canonical" href="{rel}"/>\n'
        '<meta name="robots" content="noindex"/>\n'
        f"<title>Moved — see {new_internal_rel}</title>\n"
        "</head>\n<body>\n"
        f'<p>This page has moved to <a href="{rel}">{new_internal_rel}</a>.</p>\n'
        "</body>\n</html>\n"
    )


def _is_tracked(path: Path) -> bool:
    result = subprocess.run(
        ["git", "ls-files", "--error-unmatch", str(path)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def git_mv(old_abs: Path, new_abs: Path, dry_run: bool) -> None:
    if dry_run:
        print(f"  git mv {old_abs.relative_to(REPO_ROOT)} -> {new_abs.relative_to(REPO_ROOT)}")
        return
    new_abs.parent.mkdir(parents=True, exist_ok=True)
    # Some new locations may already have files from earlier merges — fall back to delete + write.
    if new_abs.exists():
        print(
            f"  WARN: target exists, will overwrite via plain move: {new_abs.relative_to(REPO_ROOT)}"
        )
        old_abs.unlink()
        return
    # Untracked files (e.g., .DS_Store) can't be `git mv`'d. Skip them — they
    # are noise the repo doesn't need to follow.
    if not _is_tracked(old_abs):
        print(f"  skip untracked: {old_abs.relative_to(REPO_ROOT)}")
        try:
            old_abs.unlink()
        except OSError:
            pass
        return
    subprocess.run(
        ["git", "mv", str(old_abs), str(new_abs)],
        cwd=REPO_ROOT,
        check=True,
    )


def cmd_apply(args: argparse.Namespace) -> int:
    manifest_path = Path(args.manifest)
    if not manifest_path.is_absolute():
        manifest_path = REPO_ROOT / manifest_path
    only_commit = args.only_commit
    rows = load_manifest(manifest_path, only_commit=only_commit)
    if not rows:
        print(f"[apply] no rows for commit {only_commit}")
        return 1

    # Mapping uses ONLY rows in this commit. Pre-rewriting refs to files that
    # move in later commits would create dangling hrefs in the working tree.
    mapping = {r.old: r.new for r in rows}

    dry = args.dry_run
    internal_root = REPO_ROOT / INTERNAL
    print(f"[apply{' --dry-run' if dry else ''}] commit={only_commit or 'all'}, rows={len(rows)}")

    # HTML moves get redirect stubs; non-HTML moves (e.g. PlantUML assets) do not.
    html_rows = [r for r in rows if r.old.endswith(".html")]

    # 1. Rewrite hrefs in EVERY HTML under internal/ (not just moved files),
    #    so static refs from unchanged pages keep working.
    touched = 0
    for html in sorted(internal_root.rglob("*.html")):
        rel = str(html.relative_to(internal_root)).replace("\\", "/")
        page_new = mapping.get(rel, rel)
        text = html.read_text(encoding="utf-8")
        new_text = rewrite_html(text, rel, page_new, mapping)
        if new_text != text:
            touched += 1
            if not dry:
                html.write_text(new_text, encoding="utf-8")
    print(f"  rewrote {touched} HTML file(s)")

    # 2. git mv each row in commit
    merge_targets: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        if r.merge_target:
            merge_targets[r.merge_target].append(r.old)
            continue
        old_abs = internal_root / r.old
        new_abs = internal_root / r.new
        if not old_abs.exists():
            print(f"  SKIP missing: {r.old}")
            continue
        git_mv(old_abs, new_abs, dry)

    if merge_targets:
        print(f"  {sum(len(v) for v in merge_targets.values())} row(s) flagged for manual merge:")
        for target, sources in merge_targets.items():
            print(f"    {target} <- {sources}")

    # 3. Leave redirect stubs at old HTML locations (only for non-merge moves)
    for r in html_rows:
        if r.merge_target:
            continue
        old_abs = internal_root / r.old
        if dry:
            print(f"  stub: {r.old}")
            continue
        stub = make_redirect_stub(r.new, r.old)
        old_abs.parent.mkdir(parents=True, exist_ok=True)
        old_abs.write_text(stub, encoding="utf-8")
        subprocess.run(["git", "add", str(old_abs)], cwd=REPO_ROOT, check=True)

    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("plan", help="generate CSV manifest")
    pp.add_argument("--out", help="path to write manifest CSV")
    pp.set_defaults(func=cmd_plan)

    ap = sub.add_parser("apply", help="execute manifest (git mv + rewrites)")
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--only-commit",
        type=int,
        default=None,
        help="restrict to a single Phase 1 commit number (1..13)",
    )
    ap.set_defaults(func=cmd_apply)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
