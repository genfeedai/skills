#!/usr/bin/env bun
/**
 * Check the module layout: every skill sits at <module>/<skill>/ with SKILL.md,
 * README.md and metadata.json, the frontmatter name matches the folder, names
 * are unique, and no skill or stray folder sits at the repository root.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSkills, moduleNames, NON_MODULE_DIRS, ROOT } from './modules.js';

const issues = [];
const modules = new Set(moduleNames());

for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || NON_MODULE_DIRS.has(entry.name)) continue;
  if (existsSync(join(ROOT, entry.name, 'SKILL.md'))) {
    issues.push(`${entry.name}: skills must live inside a module folder (<module>/${entry.name})`);
  } else if (!modules.has(entry.name)) {
    issues.push(`${entry.name}: folder is not a module declared in scripts/modules.json`);
  }
}

const seen = new Map();
for (const moduleName of modules) {
  const dir = join(ROOT, moduleName);
  if (!existsSync(dir)) {
    issues.push(`${moduleName}: declared in scripts/modules.json but the folder is missing`);
    continue;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !existsSync(join(dir, entry.name, 'SKILL.md'))) {
      issues.push(`${moduleName}/${entry.name}: folder has no SKILL.md`);
    }
  }
}

for (const skill of allSkills()) {
  const label = `${skill.module}/${skill.name}`;
  for (const required of ['SKILL.md', 'README.md', 'metadata.json']) {
    if (!existsSync(join(skill.dir, required))) issues.push(`${label}: missing ${required}`);
  }
  if (existsSync(join(skill.dir, 'plugin.json'))) {
    issues.push(`${label}: skills must not include plugin.json`);
  }

  const text = readFileSync(join(skill.dir, 'SKILL.md'), 'utf8');
  if (!text.startsWith('---\n')) issues.push(`${label}: SKILL.md missing YAML frontmatter`);
  const name = /^name:\s*(.+)$/m
    .exec(text)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, '');
  if (!name) issues.push(`${label}: SKILL.md frontmatter missing name`);
  else if (name !== skill.name)
    issues.push(`${label}: frontmatter name '${name}' must match the folder`);
  if (!/^description:/m.test(text))
    issues.push(`${label}: SKILL.md frontmatter missing description`);

  if (seen.has(skill.name))
    issues.push(`${label}: duplicate skill name (also in ${seen.get(skill.name)})`);
  seen.set(skill.name, skill.module);

  try {
    JSON.parse(readFileSync(join(skill.dir, 'metadata.json'), 'utf8'));
  } catch (error) {
    issues.push(`${label}: invalid metadata.json (${error.message})`);
  }
}

if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`   OK: ${seen.size} skills in ${modules.size} modules`);
