#!/usr/bin/env bash
# Refuse to commit local CI/runtime artifacts that should remain gitignored.
# Catches the failure mode flagged in the 2026-05-07 portal bug audit
# (PR_BODY.md, .coverage, *.db) before it lands on a PR.

set -euo pipefail

bad=$(git diff --cached --name-only --diff-filter=AM | grep -E '(^|/)(\.coverage$|.*\.db$|PR_BODY\.md$|changelog-llm-draft\.md$)' || true)

if [ -n "$bad" ]; then
  echo "✗ Refusing to commit local artifact files (these belong in .gitignore):" >&2
  echo "$bad" >&2
  echo "  Run 'git restore --staged <file>' to unstage." >&2
  exit 1
fi
