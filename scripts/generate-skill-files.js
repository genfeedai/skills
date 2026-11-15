#!/usr/bin/env bun
/**
 * Generate each module skill's metadata.json and the generated header of its README.md
 * from the skill's SKILL.md frontmatter. Run `bun run skills:generate`; `bun run validate`
 * fails when a generated file is out of date. The JSON is formatted with Biome so it passes
 * `bun run check` as written.
 *
 * Pass --check to write nothing and fail, naming each skill, when a generated file is out of
 * date (used by `bun run validate`). Pass --git-add to stage the files that changed (used by
 * the lint-staged hook).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { allSkills, ROOT } from './modules.js';
import { readSkillFields, renderMetadata, renderReadme, SkillFieldError } from './skill-files.js';

const CHECK_ONLY = process.argv.includes('--check');
const errors = [];
const changed = [];
const BIOME = join(ROOT, 'node_modules', '.bin', 'biome');

function formatJson(path, content) {
  const result = Bun.spawnSync([BIOME, 'format', `--stdin-file-path=${relative(ROOT, path)}`], {
    cwd: ROOT,
    stdin: Buffer.from(content),
  });
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
    throw new Error(`Biome could not format ${relative(ROOT, path)}; run bun install first`);
  }
  return result.stdout.toString();
}

function writeIfChanged(path, content) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === content) return;
  if (!CHECK_ONLY) writeFileSync(path, content);
  changed.push(relative(ROOT, path));
}

for (const skill of allSkills()) {
  let fields;
  try {
    fields = readSkillFields(skill);
  } catch (error) {
    if (!(error instanceof SkillFieldError)) throw error;
    errors.push(error.message);
    continue;
  }
  const readmePath = join(skill.dir, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : null;
  writeIfChanged(readmePath, renderReadme(readme, fields));
  const metadataPath = join(skill.dir, 'metadata.json');
  writeIfChanged(metadataPath, formatJson(metadataPath, renderMetadata(fields)));
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

if (CHECK_ONLY) {
  if (changed.length > 0) {
    console.error(
      'Generated skill files are out of date (edit SKILL.md, not the generated files):'
    );
    for (const file of changed) console.error(`  ${file}`);
    console.error("Run 'bun run skills:generate' and commit the result.");
    process.exit(1);
  }
  console.log('   OK: generated skill files match SKILL.md');
  process.exit(0);
}

if (process.argv.includes('--git-add') && changed.length > 0) {
  Bun.spawnSync(['git', 'add', '--', ...changed], { cwd: ROOT });
}

console.log(`Generated README.md and metadata.json (${changed.length} files changed)`);
