/**
 * Shared module discovery for the Genfeed skills catalogue.
 *
 * Every skill lives at <module>/<skill>/SKILL.md. Modules are declared in
 * scripts/modules.json; the skills in each module are read from disk.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONFIG = JSON.parse(readFileSync(join(ROOT, 'scripts', 'modules.json'), 'utf8'));

export const NON_MODULE_DIRS = new Set([
  '.claude',
  '.claude-plugin',
  '.codex',
  '.cursor',
  '.git',
  '.github',
  '.husky',
  'dist',
  'node_modules',
  'plugins',
  'scripts',
]);

export function moduleNames() {
  return Object.keys(CONFIG.modules);
}

export function skillsInModule(moduleName) {
  const dir = join(ROOT, moduleName);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(dir, name, 'SKILL.md')))
    .sort();
}

/** All skills as { module, name, dir } in module order. */
export function allSkills() {
  return moduleNames().flatMap((moduleName) =>
    skillsInModule(moduleName).map((name) => ({
      module: moduleName,
      name,
      dir: join(ROOT, moduleName, name),
    }))
  );
}
