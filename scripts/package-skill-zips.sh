#!/usr/bin/env bash
#
# Package every root skill as a ZIP for Claude chat uploads (Customize > Skills).
#
# Each ZIP has the skill folder as its single top-level entry, with SKILL.md
# directly inside it. Output goes to dist/skill-zips/<skill>.zip.
# Usage: bash scripts/package-skill-zips.sh [skill-name ...]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/dist/skill-zips"

cd "$REPO_ROOT"

if [ "$#" -gt 0 ]; then
  SKILLS=("$@")
else
  SKILLS=()
  for skill_file in */SKILL.md; do
    SKILLS+=("$(dirname "$skill_file")")
  done
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

for skill in "${SKILLS[@]}"; do
  skill_file="$skill/SKILL.md"
  if [ ! -f "$skill_file" ]; then
    echo "ERROR: $skill_file not found" >&2
    exit 1
  fi

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

  zip -q -r -X "$OUT_DIR/$skill.zip" "$skill" -x '*/.DS_Store'
done

echo "Wrote ${#SKILLS[@]} skill ZIPs to dist/skill-zips/"
