#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "HEAD" || "$branch" == "main" || "$branch" == "master" ]]; then
  exit 0
fi

pr_body_file="PR_BODY.md"
template_file=".github/PULL_REQUEST_TEMPLATE.md"

create_template() {
  if [[ -f "$template_file" ]]; then
    cp "$template_file" "$pr_body_file"
  else
    cat >"$pr_body_file" <<'EOF'
## Summary

- What changed and why?
- What behavior is affected?

## Change type

- [ ] `delivery` (feature/API/code behavior change)
- [ ] `docs-only` (documentation structure/content/navigation only)
- [ ] `mixed` (both code and docs)

## Testing notes

- Commands run:
  - `...`
- Key output or evidence:
  - `...`

## Changelog

- [ ] Updated `CHANGELOG.md` (user-facing changes).
- [ ] Updated `docs/CHANGELOG.md` (documentation-facing changes).
- [ ] No changelog update needed (`[skip changelog]` rationale is explicit).
EOF
  fi
}

if [[ ! -f "$pr_body_file" ]]; then
  create_template
  echo "PR guard: created $pr_body_file template in repo root."
  echo "Fill it in before commit. This file is gitignored."
  exit 1
fi

if ! grep -q '[^[:space:]]' "$pr_body_file"; then
  echo "PR guard: $pr_body_file is empty."
  echo "Fill it in before commit."
  exit 1
fi

checked_types="$(grep -Ec '^- \[[xX]\] `(delivery|docs-only|mixed)`' "$pr_body_file" || true)"
if [[ "$checked_types" -ne 1 ]]; then
  echo "PR guard: exactly one Change type must be selected in $pr_body_file."
  echo "Set one of: delivery, docs-only, mixed."
  exit 1
fi

# Guard against committing a mostly untouched template.
if grep -Eq 'What changed and why\?|What behavior is affected\?|`\\.\\.\\.`|^\s*-\s+`\.\.\.`\s*$' "$pr_body_file"; then
  echo "PR guard: template placeholders detected in $pr_body_file."
  echo "Replace placeholders (for example: 'What changed and why?' or '...') with real content."
  exit 1
fi
