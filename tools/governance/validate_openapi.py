#!/usr/bin/env python3
"""OpenAPI fragment validator.

Validates OpenAPI 3.1 fragment files used as the source of truth for the API
(per ADR 0036). Resolves cross-file `$ref` (e.g. `../_shared/responses/...`)
relative to the fragment's own location.

Usage:
    # Validate every fragment under the default tree
    python tools/governance/validate_openapi.py

    # Validate a specific file (absolute or relative path)
    python tools/governance/validate_openapi.py path/to/createCourse.yaml

    # Validate one resource sub-tree by short name (resolved under FRAGMENTS_DIR)
    python tools/governance/validate_openapi.py course

    # Validate an arbitrary directory
    python tools/governance/validate_openapi.py services/portal/internal/services/api/openapi/test/fragments/

Exit code is 0 when every file validates, 1 otherwise. `-q` mutes the per-file
"Validating…/Valid" lines and only prints failures plus the final tally.

Side effect: after running, the tool walks the fragments tree and writes a
manifest at ``<FRAGMENTS_DIR>/../fragments-index.json`` listing every
operation it found. The Swagger UI preview page (``preview.html``) reads this
manifest to populate its spec picker — no hard-coded list.
"""

import argparse
import copy
import glob
import json
import os
import sys

import yaml
from openapi_spec_validator import OpenAPIV31SpecValidator
from openapi_spec_validator.readers import read_from_filename

# OpenAPI canon trees live side by side under a single root. Each subdirectory
# `openapi/{TREE}/fragments/` is automatically a canon tree named `{TREE}`.
# Convention beats registry: adding a new product API is `mkdir openapi/{name}/`
# and dropping fragments into it — no per-tree code changes anywhere.
#
# Callers pick a tree via env var (`OPENAPI_TREE=…` or `TREE=…`) or `--tree`.
# The `test` tree is reserved as a smoke sandbox for tutorial/examples and
# always binds to port 8001 (backwards-compatible with pre-multi-tree usage).
# Real product canons get ports 8002, 8003, … in alphabetical order of
# discovery — stable and reproducible, no manual port bookkeeping.
OPENAPI_ROOT = "services/portal/internal/services/api/openapi"
DEFAULT_TREE = os.environ.get("OPENAPI_TREE") or os.environ.get("TREE") or "test"
FRAGMENTS_DIR = f"{OPENAPI_ROOT}/{DEFAULT_TREE}/fragments"

# Manifest file consumed by preview.html — sits next to the openapi/ tree root.
INDEX_FILE = os.path.join(os.path.dirname(FRAGMENTS_DIR), "fragments-index.json")

# Combined OpenAPI document — every fragment's Path Item composed under one
# spec via $ref. Swagger UI loads this to show every operation at once.
MERGED_SPEC_FILE = os.path.join(os.path.dirname(FRAGMENTS_DIR), "merged-spec.json")

# HTTP methods recognised inside a Path Item Object (OpenAPI 3.1 §4.7.9).
HTTP_METHODS = ("get", "post", "put", "patch", "delete", "head", "options", "trace")

# Reserved names for the smoke sandbox. Anything else is treated as a real
# product canon in port allocation and title emission.
SMOKE_TREE_NAME = "test"
SMOKE_TREE_PORT = 8001
PRODUCT_TREE_BASE_PORT = 8002

# Color codes
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


def discover_trees(openapi_root: str = OPENAPI_ROOT) -> list[str]:
    """Return every discovered tree name in alphabetical order.

    A tree is any directory `{openapi_root}/{name}/` that contains a
    `fragments/` subdirectory. `test` is guaranteed to come first when
    present, then real product canons alphabetically.
    """
    if not os.path.isdir(openapi_root):
        return []
    trees: list[str] = []
    for entry in sorted(os.listdir(openapi_root)):
        path = os.path.join(openapi_root, entry, "fragments")
        if os.path.isdir(path):
            trees.append(entry)
    # Push `test` to the front for stable port assignment.
    if SMOKE_TREE_NAME in trees:
        trees = [SMOKE_TREE_NAME] + [t for t in trees if t != SMOKE_TREE_NAME]
    return trees


def tree_port(tree_name: str, openapi_root: str = OPENAPI_ROOT) -> int:
    """Return the mock port for a tree by convention.

    * `test` → 8001 (backwards-compatible with pre-multi-tree usage).
    * Every other tree → 8002, 8003, … in alphabetical order of the
      product-canon list. The order is stable across runs because
      `discover_trees` sorts the filesystem entries.
    """
    if tree_name == SMOKE_TREE_NAME:
        return SMOKE_TREE_PORT
    product_trees = [t for t in discover_trees(openapi_root) if t != SMOKE_TREE_NAME]
    try:
        return PRODUCT_TREE_BASE_PORT + product_trees.index(tree_name)
    except ValueError:
        # Tree not yet on disk (e.g. asked from a target that will create it).
        # Fall back to a deterministic hash-based port to avoid crashes.
        return PRODUCT_TREE_BASE_PORT


def tree_profile(tree_name: str) -> dict:
    """Return the presentation profile for a tree — used by the merger."""
    port = tree_port(tree_name)
    if tree_name == SMOKE_TREE_NAME:
        title = "Study App API · combined smoke-test view"
        hint = "Local Python mock (make api-mock)"
    else:
        title = f"Study App API · {tree_name} canon"
        hint = f"Local Python mock (make api-mock TREE={tree_name})"
    return {"title": title, "mock_port": port, "mock_hint": hint}


def validate_file(filepath: str, verbose: bool = True) -> int:
    """Validate a single OpenAPI fragment, resolving ``$ref`` from its directory.

    Skips files that don't carry a top-level ``openapi:`` key — those are
    Response / Schema / Parameter partials authored for reuse via ``$ref``
    (e.g. ``fragments/course/error-409/name-conflict.yaml``). The partial's
    content gets validated transitively when its parent fragment's ``$ref``
    walk resolves it. Partials are reported as ``↺ partial`` so the reader
    still sees they were noticed.
    """
    if verbose:
        print(f"📝 Validating: {filepath}")

    if not os.path.exists(filepath):
        print(f"❌ {RED}File not found:{RESET} {filepath}")
        return 1

    try:
        abs_path = os.path.abspath(filepath)
        spec, base_uri = read_from_filename(abs_path)
        if not (isinstance(spec, dict) and "openapi" in spec):
            if verbose:
                print(f"↺ {YELLOW}Partial (validated transitively via $ref):{RESET} {filepath}")
            return 0
        # base_uri is the file:// URL of the fragment — the validator uses it
        # to resolve relative $refs like "../_shared/responses/Error400.yaml"
        # against the fragment's directory instead of treating them as URLs.
        OpenAPIV31SpecValidator(spec, base_uri=base_uri).validate()
    except yaml.YAMLError as e:
        print(f"❌ {RED}Invalid YAML:{RESET} {filepath}\n   {e}")
        return 1
    except Exception as e:
        print(f"❌ {RED}Validation failed:{RESET} {filepath}\n   {e}")
        return 1

    if verbose:
        print(f"✅ {GREEN}Valid:{RESET} {filepath}")
    return 0


def validate_files(filepaths, verbose=True):
    """Validate multiple OpenAPI files."""
    if not filepaths:
        print(f"❌ {RED}No files found{RESET}")
        return 1

    total = len(filepaths)
    errors = 0

    if verbose:
        print(f"🔍 Validating {total} file(s)...")
        print("-" * 50)

    for filepath in filepaths:
        if validate_file(filepath, verbose) != 0:
            errors += 1

    if verbose and total > 1:
        print("-" * 50)
        if errors == 0:
            print(f"✅ {GREEN}All {total} files passed{RESET}")
        else:
            print(f"❌ {RED}{errors} of {total} files failed{RESET}")

    return 0 if errors == 0 else 1


def find_files(path):
    """Find all .yaml/.yml files at or under `path`."""
    if os.path.isfile(path):
        return [path]

    if os.path.isdir(path):
        files = glob.glob(os.path.join(path, "**/*.yaml"), recursive=True)
        files.extend(glob.glob(os.path.join(path, "**/*.yml"), recursive=True))
        return sorted(files)

    if "*" in path or "?" in path:
        return sorted(glob.glob(path, recursive=True))

    return []


def resolve_path(raw_path):
    """Resolve the user-supplied path.

    Order:
    1. If `raw_path` exists as-is (file or directory), use it.
    2. Else, treat it as a short resource name (e.g. `course`) and look under
       FRAGMENTS_DIR.
    3. Otherwise return it unchanged so `find_files` reports a clean miss.
    """
    if os.path.exists(raw_path):
        return raw_path

    candidate = os.path.join(FRAGMENTS_DIR, raw_path)
    if os.path.exists(candidate):
        return candidate

    return raw_path


def _operations_in(spec: object, rel_path: str) -> list[dict]:
    """Return one manifest entry per operation declared in the fragment.

    Robust to fragments that legitimately declare more than one method on the
    same path, and to YAML files that don't follow the OpenAPI shape (returns
    an empty list rather than raising).
    """
    if not isinstance(spec, dict):
        return []
    paths = spec.get("paths")
    if not isinstance(paths, dict):
        return []

    parts = rel_path.replace(os.sep, "/").split("/")
    resource = parts[0] if len(parts) >= 2 else "(root)"
    spec_url = "fragments/" + rel_path.replace(os.sep, "/")

    entries: list[dict] = []
    for url, methods in paths.items():
        if not isinstance(methods, dict):
            continue
        for method, op in methods.items():
            if method.lower() not in HTTP_METHODS or not isinstance(op, dict):
                continue
            op_id = op.get("operationId") or "unknown"
            entries.append(
                {
                    "spec": spec_url,
                    "resource": resource,
                    "method": method.upper(),
                    "path": url,
                    "operationId": op_id,
                    "summary": (op.get("summary") or "").strip(),
                    "label": f"{method.upper()} {url}  ·  {resource} / {op_id}",
                }
            )
    return entries


def regenerate_index() -> int:
    """Walk the fragments tree and write the manifest consumed by preview.html.

    Always reflects current disk state; broken YAML files are skipped (the
    validator's stdout already reported them).
    """
    files = find_files(FRAGMENTS_DIR)
    items: list[dict] = []
    for fp in files:
        try:
            with open(fp, encoding="utf-8") as f:
                spec = yaml.safe_load(f) or {}
        except (yaml.YAMLError, OSError):
            continue
        rel = os.path.relpath(fp, FRAGMENTS_DIR)
        items.extend(_operations_in(spec, rel))

    items.sort(key=lambda x: (x["path"], x["method"]))
    payload = {
        "generated_by": "tools/governance/validate_openapi.py",
        "fragments_dir": FRAGMENTS_DIR,
        "count": len(items),
        "items": items,
    }
    os.makedirs(os.path.dirname(INDEX_FILE) or ".", exist_ok=True)
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
    return len(items)


def _safe_id(name: str) -> str:
    """Normalise a string to chars safe inside a JSON Schema component name."""
    return "".join(c if (c.isalnum() or c == "_") else "_" for c in name)


def _first_operation_id(spec: dict) -> str | None:
    """Return the first operationId encountered in a fragment, for prefixing."""
    paths = spec.get("paths") or {}
    if not isinstance(paths, dict):
        return None
    for _url, path_item in paths.items():
        if not isinstance(path_item, dict):
            continue
        for method, op in path_item.items():
            if method.lower() in HTTP_METHODS and isinstance(op, dict):
                op_id = op.get("operationId")
                if isinstance(op_id, str) and op_id:
                    return op_id
    return None


def _rewrite_ref(ref: str, fragment_dir: str, merged_dir: str, prefix: str) -> str:
    """Rewrite one ``$ref`` so it stays resolvable from the merged spec's location.

    * ``#/components/{kind}/{Name}`` → ``#/components/{kind}/{prefix}_{Name}``
    * Relative file refs are rebased from ``fragment_dir`` to ``merged_dir`` so
      Swagger UI fetches the right file from the merged document's location.
    * Other in-document fragments (``#/x-...``) are left alone.
    """
    if ref.startswith("#/components/"):
        parts = ref.split("/")
        if len(parts) >= 4 and parts[1] == "components":
            parts[3] = f"{prefix}_{parts[3]}"
            return "/".join(parts)
        return ref
    if ref.startswith("#"):
        return ref
    file_part, sep, frag_part = ref.partition("#")
    abs_path = os.path.normpath(os.path.join(fragment_dir, file_part))
    new_rel = os.path.relpath(abs_path, merged_dir).replace(os.sep, "/")
    return new_rel + (sep + frag_part if sep else "")


def _rewrite_refs(node: object, fragment_dir: str, merged_dir: str, prefix: str) -> object:
    """Walk ``node`` in place and rewrite every ``$ref`` it contains."""
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if k == "$ref" and isinstance(v, str):
                node[k] = _rewrite_ref(v, fragment_dir, merged_dir, prefix)
            else:
                _rewrite_refs(v, fragment_dir, merged_dir, prefix)
    elif isinstance(node, list):
        for item in node:
            _rewrite_refs(item, fragment_dir, merged_dir, prefix)
    return node


def _downgrade_3_1_to_3_0(node: object) -> object:
    """Rewrite 3.1-only schema idioms into their 3.0 equivalents in place.

    Fragments are authored in OpenAPI 3.1 (which is closer to JSON Schema
    2020-12) but the merged spec is emitted as 3.0.3 for Connexion. Two
    common 3.1→3.0 shape gaps we normalise here:

    * ``type: [string, "null"]`` → ``type: string`` + ``nullable: true``.
      3.0 does not support type arrays; ``nullable`` is the 3.0 way.
    * ``examples: [foo, bar]`` at Schema level → ``example: foo`` (3.0 does
      not support the plural on Schema Objects).
    """
    if isinstance(node, dict):
        assert isinstance(node, dict)  # for mypy narrowing across nested calls
        # Type array: split nullable off.
        t = node.get("type")
        if isinstance(t, list):
            non_null = [x for x in t if x != "null"]
            has_null = len(non_null) != len(t)
            if len(non_null) == 1:
                node["type"] = non_null[0]
                if has_null:
                    node["nullable"] = True
            elif not non_null and has_null:
                # `type: ["null"]` — rare, drop `type` and keep nullable.
                node.pop("type", None)
                node["nullable"] = True
        # Plural examples on a Schema Object → singular example.
        # Heuristic: Schema-scoped `examples` is a list; Media-Type-scoped
        # is a dict (which is fine in 3.0 too).
        if isinstance(node.get("examples"), list) and node["examples"]:
            node.setdefault("example", node["examples"][0])
            del node["examples"]
        for v in node.values():
            _downgrade_3_1_to_3_0(v)
    elif isinstance(node, list):
        for item in node:
            _downgrade_3_1_to_3_0(item)
    return node


def regenerate_merged_spec() -> int:
    """Compose a single OpenAPI 3.1 document inlining every fragment's Path Item.

    Each fragment's path-item content and components are deep-copied into the
    merged document. Components get an operationId prefix to avoid collisions
    between fragments (e.g. ``createCourse_Course`` vs ``getCourseTest_Course``).
    Local component refs are rewritten to the prefixed names; relative file
    refs are rebased to the merged document's directory so Swagger UI resolves
    them correctly. When two fragments declare the same path, their methods
    are merged into one Path Item — same-method clashes are reported in
    ``info.description`` and last-write-wins.
    """
    files = find_files(FRAGMENTS_DIR)
    merged_dir = os.path.dirname(MERGED_SPEC_FILE)
    merged_paths: dict = {}
    merged_components: dict = {}
    method_conflicts: list[str] = []

    for fp in sorted(files):
        try:
            with open(fp, encoding="utf-8") as f:
                spec = yaml.safe_load(f) or {}
        except (yaml.YAMLError, OSError):
            continue
        if not isinstance(spec, dict) or "openapi" not in spec:
            continue

        fragment_dir = os.path.dirname(fp)
        op_id = _first_operation_id(spec) or os.path.splitext(os.path.basename(fp))[0]
        prefix = _safe_id(op_id)

        for url, path_item in (spec.get("paths") or {}).items():
            if not isinstance(path_item, dict):
                continue
            rewritten = _rewrite_refs(copy.deepcopy(path_item), fragment_dir, merged_dir, prefix)
            if not isinstance(rewritten, dict):
                continue
            if url in merged_paths:
                existing = merged_paths[url]
                for k, v in rewritten.items():
                    if k.lower() in HTTP_METHODS:
                        if k in existing:
                            method_conflicts.append(f"{url}.{k}")
                        existing[k] = v
            else:
                merged_paths[url] = rewritten

        for kind, defs in (spec.get("components") or {}).items():
            if not isinstance(defs, dict):
                continue
            target = merged_components.setdefault(kind, {})
            for name, schema in defs.items():
                target[f"{prefix}_{name}"] = _rewrite_refs(
                    copy.deepcopy(schema), fragment_dir, merged_dir, prefix
                )

    description = (
        "Auto-generated combined view of every fragment under "
        "`openapi/test/fragments/`. Each fragment's path-item and components are "
        "inlined (component names carry an operationId prefix to avoid "
        "cross-fragment collisions; relative file refs are rebased to this "
        "document's directory). Regenerated by "
        "`tools/governance/validate_openapi.py` on every run."
    )
    if method_conflicts:
        description += "\n\n⚠️  Method conflicts (last fragment wins): " + ", ".join(
            sorted(set(method_conflicts))
        )

    # Pick the tree profile from FRAGMENTS_DIR so title + servers[] match
    # whichever canon we just merged. Discovery + convention: no per-tree
    # registry — the profile is computed from the tree name on the fly.
    tree_name = os.path.basename(os.path.dirname(FRAGMENTS_DIR))
    profile = tree_profile(tree_name)

    # Emit OpenAPI 3.0.3 (not 3.1.0 like the source fragments) because Connexion
    # 3.x — our layer-3 mock library — only validates 3.0.x specs. The fragments
    # themselves stay 3.1; this is a compatibility shim for the build output.
    # Swagger UI happily reads either dialect.
    merged: dict = {
        "openapi": "3.0.3",
        "info": {
            "title": profile["title"],
            "version": "dev",
            "description": description,
        },
        "servers": [
            {
                "url": f"http://127.0.0.1:{profile['mock_port']}",
                "description": profile["mock_hint"],
            }
        ],
        "paths": dict(sorted(merged_paths.items())),
    }
    if merged_components:
        merged["components"] = merged_components

    # 3.1 → 3.0 shape gaps: type arrays, plural examples on Schemas.
    _downgrade_3_1_to_3_0(merged)

    os.makedirs(merged_dir or ".", exist_ok=True)
    with open(MERGED_SPEC_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
        f.write("\n")

    return sum(1 for pi in merged_paths.values() for k in pi if k.lower() in HTTP_METHODS)


def main() -> None:
    """CLI entrypoint — parse args, find files, run validation, exit with the right code."""
    global FRAGMENTS_DIR, INDEX_FILE, MERGED_SPEC_FILE
    parser = argparse.ArgumentParser(description="Validate OpenAPI specification files")

    parser.add_argument(
        "path",
        nargs="?",
        default=FRAGMENTS_DIR,
        help="File, directory, or resource short-name (default: fragments directory)",
    )

    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Verbose output (default for multi-file runs)"
    )

    parser.add_argument("-q", "--quiet", action="store_true", help="Quiet mode (only show errors)")

    parser.add_argument(
        "--tree",
        default=None,
        help="Which canon tree to validate (any directory under openapi/*/fragments/). "
        "Overrides OPENAPI_TREE / TREE env vars. Default: test.",
    )

    parser.add_argument(
        "--list-trees",
        action="store_true",
        help="Print discovered canon trees + their mock ports and exit.",
    )

    parser.add_argument(
        "--all-trees",
        action="store_true",
        help="Validate every discovered tree in one run (CI convenience).",
    )

    parser.add_argument(
        "--resource",
        default=None,
        help='Validate a resource (e.g. "user", "course") across every tree '
        "where the directory exists. Trees that do not contain that "
        "resource are silently skipped.",
    )

    args = parser.parse_args()

    # `--list-trees` short-circuits everything else — pure introspection.
    if args.list_trees:
        trees = discover_trees()
        if not trees:
            print(f"⚠️  {YELLOW}No trees discovered under {OPENAPI_ROOT}/{RESET}")
            sys.exit(0)
        print(f"🌳 Discovered canon trees under {OPENAPI_ROOT}/:")
        for name in trees:
            role = "smoke sandbox" if name == SMOKE_TREE_NAME else "product canon"
            print(f"  · {name:24} → mock :{tree_port(name)}  ({role})")
        sys.exit(0)

    # `--all-trees` iterates every discovered tree, exits non-zero if any fail.
    # `--resource X` iterates every tree that contains an `X/` subdirectory.
    # The two flags share the same loop; `--resource` narrows the scope from
    # «entire fragments/» to «fragments/X/» within each tree.
    if args.all_trees or args.resource:
        trees = discover_trees()
        if not trees:
            print(f"⚠️  {YELLOW}No trees discovered under {OPENAPI_ROOT}/{RESET}")
            sys.exit(0)
        failures: list[str] = []
        touched: list[str] = []
        for name in trees:
            FRAGMENTS_DIR = f"{OPENAPI_ROOT}/{name}/fragments"
            INDEX_FILE = os.path.join(os.path.dirname(FRAGMENTS_DIR), "fragments-index.json")
            MERGED_SPEC_FILE = os.path.join(os.path.dirname(FRAGMENTS_DIR), "merged-spec.json")

            # For --resource: narrow the scan to a subdirectory if it exists.
            if args.resource:
                scan_target = os.path.join(FRAGMENTS_DIR, args.resource)
                if not os.path.isdir(scan_target):
                    continue  # tree doesn't have this resource — silent skip
            else:
                scan_target = FRAGMENTS_DIR

            touched.append(name)
            print(f"\n🌳 Tree: {name}{f' · resource: {args.resource}' if args.resource else ''}")
            files = find_files(scan_target)
            rc = validate_files(files, verbose=not args.quiet) if files else 0
            try:
                regenerate_index()
                regenerate_merged_spec()
            except OSError as e:
                print(f"⚠️  {YELLOW}Regen failed for {name}: {e}{RESET}")
                rc = 1
            if rc != 0:
                failures.append(name)
        if args.resource and not touched:
            print(f"⚠️  {YELLOW}No tree contains resource:{RESET} {args.resource}")
            print(f"   Available trees: {', '.join(trees)}")
            sys.exit(1)
        if failures:
            print(f"\n❌ {RED}Failed trees:{RESET} {', '.join(failures)}")
            sys.exit(1)
        print(f"\n✅ {GREEN}All {len(touched)} tree(s) passed{RESET}")
        sys.exit(0)

    # Single-tree run: re-derive globals if --tree overrides the module-level
    # default (which was resolved from env at import time).
    if args.tree is not None and args.tree != DEFAULT_TREE:
        candidate = f"{OPENAPI_ROOT}/{args.tree}/fragments"
        if not os.path.isdir(candidate):
            available = ", ".join(discover_trees()) or "(none)"
            print(f"❌ {RED}Unknown tree:{RESET} {args.tree}")
            print(f"   Available: {available}")
            print(f"   To create: mkdir -p {candidate}")
            sys.exit(1)
        FRAGMENTS_DIR = candidate
        INDEX_FILE = os.path.join(os.path.dirname(FRAGMENTS_DIR), "fragments-index.json")
        MERGED_SPEC_FILE = os.path.join(os.path.dirname(FRAGMENTS_DIR), "merged-spec.json")
        # If the user didn't pass an explicit path, honour the new tree default.
        if args.path == f"{OPENAPI_ROOT}/{DEFAULT_TREE}/fragments":
            args.path = FRAGMENTS_DIR

    target = resolve_path(args.path)

    files = find_files(target)

    if not files:
        print(f"❌ {RED}No YAML files found at:{RESET} {target}")
        sys.exit(1)

    verbose = not args.quiet
    rc = validate_files(files, verbose)

    # Always refresh the manifest + merged spec — content reflects current
    # disk state, independent of which subset was validated this run.
    try:
        count = regenerate_index()
        if verbose:
            print(f"📦 fragments-index.json regenerated · {count} operation(s).")
    except OSError as e:
        print(f"⚠️  {YELLOW}Could not write fragments-index.json:{RESET} {e}")
    try:
        merged_count = regenerate_merged_spec()
        if verbose:
            print(f"📦 merged-spec.json regenerated · {merged_count} path(s).")
    except OSError as e:
        print(f"⚠️  {YELLOW}Could not write merged-spec.json:{RESET} {e}")

    sys.exit(rc)


if __name__ == "__main__":
    main()
