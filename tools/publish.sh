#!/usr/bin/env bash
# One-shot publish: create the GitHub repo (if needed), push main, enable GitHub Pages.
# Needs: gh logged in as the target account (gh auth login -h github.com).
set -euo pipefail
OWNER="${1:-AliHaider93}"
REPO="${2:-sprout-siege}"
cd "$(dirname "$0")/.."

if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" --public --description "Sprout Siege: plant shooting plants against incoming zombies, in your browser" --homepage "https://${OWNER,,}.github.io/$REPO/"
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "git@github.com:$OWNER/$REPO.git"
git push -u origin main

# Enable Pages from the main branch root (ignore error if already enabled).
gh api -X POST "repos/$OWNER/$REPO/pages" -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/' >/dev/null 2>&1 || true
gh api "repos/$OWNER/$REPO/pages" --jq '"Pages: " + .html_url + "  (status: " + (.status // "building") + ")"'
