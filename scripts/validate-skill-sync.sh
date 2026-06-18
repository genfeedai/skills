#!/usr/bin/env bash
#
# Validate Genfeed skills for skills.sh and Claude Marketplace packaging.
#
# Source skills live at the repository root. Marketplace bundles are generated
# snapshots under bundles/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "Validating Genfeed skills..."
SKILL_COUNT="$(
  find . \
    -path './.claude-plugin' -prune -o \
    -path './.git' -prune -o \
    -path './.github' -prune -o \
    -path './.husky' -prune -o \
    -path './bundles' -prune -o \
    -path './node_modules' -prune -o \
    -path './scripts' -prune -o \
    -mindepth 2 -maxdepth 2 -name SKILL.md -print | wc -l | tr -d ' '
)"

echo "1. Checking root skill structure"
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const ignored = new Set([
  '.claude-plugin',
  '.git',
  '.github',
  '.husky',
  'bundles',
  'node_modules',
  'scripts',
]);

const skillNames = fs
  .readdirSync('.', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !ignored.has(name))
  .filter((name) => fs.existsSync(path.join(name, 'SKILL.md')))
  .sort();

const issues = [];

for (const skillName of skillNames) {
  for (const required of ['SKILL.md', 'README.md', 'metadata.json']) {
    if (!fs.existsSync(path.join(skillName, required))) {
      issues.push(`${skillName}: missing ${required}`);
    }
  }

  if (fs.existsSync(path.join(skillName, 'plugin.json'))) {
    issues.push(`${skillName}: root skills must not include plugin.json`);
  }

  const skillText = fs.readFileSync(path.join(skillName, 'SKILL.md'), 'utf8');
  if (!skillText.startsWith('---\n')) {
    issues.push(`${skillName}: SKILL.md missing YAML frontmatter`);
  }
  if (!/^name:/m.test(skillText)) {
    issues.push(`${skillName}: SKILL.md frontmatter missing name`);
  }
  if (!/^description:/m.test(skillText)) {
    issues.push(`${skillName}: SKILL.md frontmatter missing description`);
  }

  try {
    JSON.parse(fs.readFileSync(path.join(skillName, 'metadata.json'), 'utf8'));
  } catch (error) {
    issues.push(`${skillName}: invalid metadata.json (${error.message})`);
  }
}

if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`   OK: ${skillNames.length} root skills`);
NODE

echo "2. Checking bundle category coverage"
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const ignored = new Set([
  '.claude-plugin',
  '.git',
  '.github',
  '.husky',
  'bundles',
  'node_modules',
  'scripts',
]);

const rootSkills = fs
  .readdirSync('.', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !ignored.has(name))
  .filter((name) => fs.existsSync(path.join(name, 'SKILL.md')))
  .sort();

const categories = JSON.parse(fs.readFileSync('scripts/plugin-categories.json', 'utf8'));
const referencedSkills = [...new Set(Object.values(categories.bundles).flatMap((bundle) => bundle.skills))].sort();

const missing = referencedSkills.filter((skill) => !rootSkills.includes(skill));
const unreferenced = rootSkills.filter((skill) => !referencedSkills.includes(skill));

if (missing.length > 0 || unreferenced.length > 0) {
  if (missing.length > 0) {
    console.error(`Missing root skills referenced by bundles:\n${missing.map((skill) => `  - ${skill}`).join('\n')}`);
  }
  if (unreferenced.length > 0) {
    console.error(`Root skills not referenced by any focused bundle:\n${unreferenced.map((skill) => `  - ${skill}`).join('\n')}`);
  }
  process.exit(1);
}

console.log(`   OK: ${referencedSkills.length} skills covered by focused bundles`);
NODE

echo "3. Regenerating marketplace bundles"
bun run marketplace:generate

echo "4. Checking generated plugin JSON"
for file in .claude-plugin/marketplace.json bundles/*/plugin.json; do
  node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$file"
done

if find bundles -path '*/skills/*/plugin.json' -print -quit | grep -q .; then
  echo "Generated bundle skill folders must not contain nested plugin.json files" >&2
  find bundles -path '*/skills/*/plugin.json' -print >&2
  exit 1
fi

echo "5. Checking skills CLI discovery"
SKILLS_LIST_OUTPUT="$(mktemp)"
trap 'rm -f "$SKILLS_LIST_OUTPUT"' EXIT
bunx skills add . --list --full-depth >"$SKILLS_LIST_OUTPUT"
if ! grep -Eq "Found .*${SKILL_COUNT}.* skills" "$SKILLS_LIST_OUTPUT"; then
  cat "$SKILLS_LIST_OUTPUT"
  echo "Expected skills CLI to discover ${SKILL_COUNT} skills" >&2
  exit 1
fi

echo "6. Running repo checks"
bun run check
bun run lint

echo "OK: Genfeed skills are valid for skills.sh and marketplace bundles"
