#!/usr/bin/env bash
#
# Package every skill as a ZIP for Claude chat uploads (Customize > Skills).
#
# Skills live at <module>/<skill>/. Each ZIP has the skill folder as its single
# top-level entry, with SKILL.md directly inside it. Output goes to
# dist/skill-zips/<skill>.zip.
# Usage: bash scripts/package-skill-zips.sh [skill-name ...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/dist/skill-zips"

cd "$REPO_ROOT"

# Every module skill folder, as <module>/<skill>.
ALL_SKILL_DIRS=()
for skill_file in */*/SKILL.md; do
  case "$skill_file" in
    node_modules/* | plugins/* | scripts/* | dist/*) continue ;;
  esac
  ALL_SKILL_DIRS+=("$(dirname "$skill_file")")
done

SKILL_DIRS=()
if [ "$#" -gt 0 ]; then
  for wanted in "$@"; do
    match=""
    for dir in "${ALL_SKILL_DIRS[@]}"; do
      if [ "$(basename "$dir")" = "$wanted" ]; then
        match="$dir"
      fi
    done
    if [ -z "$match" ]; then
      echo "ERROR: skill '$wanted' not found in any module" >&2
      exit 1
    fi
    SKILL_DIRS+=("$match")
  done
else
  SKILL_DIRS=("${ALL_SKILL_DIRS[@]}")
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

for dir in "${SKILL_DIRS[@]}"; do
  module="$(dirname "$dir")"
  skill="$(basename "$dir")"
  skill_file="$dir/SKILL.md"

  declared_name="$(sed -n 's/^name: *//p' "$skill_file" | head -n 1 | tr -d '\r"')"
  if [ "$declared_name" != "$skill" ]; then
    echo "ERROR: $skill_file declares name '$declared_name', folder is '$skill'" >&2
    exit 1
  fi

  case "$skill" in
    *claude* | *anthropic*)
      echo "ERROR: '$skill' contains a name Claude chat reserves" >&2
      exit 1
      ;;
  esac

  (cd "$module" && zip -q -r -X "$OUT_DIR/$skill.zip" "$skill" -x '*/.DS_Store')
done

echo "Wrote ${#SKILL_DIRS[@]} skill ZIPs to dist/skill-zips/"
