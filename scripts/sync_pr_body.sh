#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "HEAD" || "$branch" == "main" || "$branch" == "master" ]]; then
  exit 0
fi

pr_body_file="PR_BODY.md"
if [[ ! -s "$pr_body_file" ]]; then
  echo "PR sync: $pr_body_file is missing or empty."
  echo "Run commit first; check_pr_body.sh will create a template when needed."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "PR sync: GitHub CLI (gh) is not installed."
  echo "Install gh or bypass with: SKIP_PR_SYNC=1 git push"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "PR sync: gh is not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

if [[ "${SKIP_PR_SYNC:-0}" == "1" ]]; then
  echo "PR sync: skipped (SKIP_PR_SYNC=1)."
  exit 0
fi

default_base="$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || true)"
if [[ -z "${default_base:-}" ]]; then
  default_base="main"
fi

pr_number="$(gh pr view --head "$branch" --json number --jq '.number' 2>/dev/null || true)"
if [[ -n "$pr_number" ]]; then
  gh pr edit "$pr_number" --body-file "$pr_body_file" >/dev/null
  echo "PR sync: updated PR #$pr_number body from $pr_body_file."
  exit 0
fi

title="$(git log -1 --pretty=%s)"
if [[ -z "$title" ]]; then
  title="$branch"
fi

gh pr create \
  --base "$default_base" \
  --head "$branch" \
  --title "$title" \
  --body-file "$pr_body_file" >/dev/null

echo "PR sync: created PR for branch $branch with body from $pr_body_file."
