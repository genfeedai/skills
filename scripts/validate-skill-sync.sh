#!/usr/bin/env bash
#
# Validate Genfeed skills for skills.sh and Claude Marketplace packaging.
#
# Skills live at <module>/<skill>/SKILL.md. Modules are declared in
# scripts/modules.json and published as Claude Marketplace plugins.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "Validating Genfeed skills..."

echo "1. Checking module layout"
bun scripts/check-modules.js

echo "2. Regenerating marketplace.json"
bun run marketplace:generate
node -e "JSON.parse(require('node:fs').readFileSync('.claude-plugin/marketplace.json', 'utf8'))"
if ! git diff --quiet -- .claude-plugin/marketplace.json; then
  echo "marketplace.json was out of date; commit the regenerated file" >&2
  git --no-pager diff --stat -- .claude-plugin/marketplace.json >&2
  exit 1
fi

echo "3. Validating the Genfeed plugin bundle"
bun scripts/validate-plugin.js

echo "4. Checking skills CLI discovery"
# Expected: every module skill, plus the MCP plugin skills whose names no module uses.
EXPECTED="$(
  {
    find . -mindepth 3 -maxdepth 3 -name SKILL.md -not -path './node_modules/*' -not -path './plugins/*' -not -path './.git/*' |
      awk -F/ '{print $3}'
    find plugins -mindepth 4 -maxdepth 4 -name SKILL.md | awk -F/ '{print $4}'
  } | sort -u
)"
EXPECTED_COUNT="$(printf '%s\n' "$EXPECTED" | grep -c .)"
SKILLS_LIST_OUTPUT="$(mktemp)"
trap 'rm -f "$SKILLS_LIST_OUTPUT"' EXIT
bunx skills add . --list >"$SKILLS_LIST_OUTPUT"
if grep -q "Skipped" "$SKILLS_LIST_OUTPUT"; then
  grep "Skipped" "$SKILLS_LIST_OUTPUT" >&2
  echo "skills CLI skipped a skill (frontmatter did not parse)" >&2
  exit 1
fi
if ! grep -Eq "Found .*${EXPECTED_COUNT}.* skills" "$SKILLS_LIST_OUTPUT"; then
  cat "$SKILLS_LIST_OUTPUT"
  echo "Expected skills CLI to discover ${EXPECTED_COUNT} skills" >&2
  exit 1
fi

echo "5. Checking per-module install paths"
for module in $(node -e "console.log(Object.keys(JSON.parse(require('node:fs').readFileSync('scripts/modules.json','utf8')).modules).join(' '))"); do
  module_count="$(find "$module" -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l | tr -d ' ')"
  bunx skills add "./$module" --list >"$SKILLS_LIST_OUTPUT"
  if ! grep -Eq "Found .*${module_count}.* skill" "$SKILLS_LIST_OUTPUT"; then
    cat "$SKILLS_LIST_OUTPUT"
    echo "Expected skills CLI to discover ${module_count} skills in ${module}/" >&2
    exit 1
  fi
done

echo "6. Running repo checks"
bun run check
bun run lint

echo "OK: Genfeed skills are valid for skills.sh and the Claude Marketplace"
