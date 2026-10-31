#!/usr/bin/env bun
/**
 * Generate .claude-plugin/marketplace.json from scripts/modules.json.
 *
 * Each module folder is a plugin (genfeedai-<module>) whose skills are listed
 * explicitly, so Claude Code and the skills CLI read the source folders directly.
 * genfeedai-all lists every skill. No copies are generated.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSkills, CONFIG, moduleNames, ROOT, skillsInModule } from './modules.js';

const plugins = [
  {
    name: 'genfeedai-all',
    source: './',
    strict: false,
    description: 'All Genfeed skills, every module',
    skills: allSkills().map((skill) => `./${skill.module}/${skill.name}`),
  },
  ...moduleNames().map((moduleName) => ({
    name: `genfeedai-${moduleName}`,
    source: `./${moduleName}`,
    strict: false,
    description: CONFIG.modules[moduleName].description,
    skills: skillsInModule(moduleName).map((name) => `./${name}`),
  })),
  // The Genfeed plugin (skills + remote MCP server) is authored directly, not generated.
  {
    name: 'genfeed',
    source: './plugins/genfeed',
    description:
      'Genfeed content skills plus the Genfeed MCP server: plan, write, generate and schedule social content, with confirmation before anything is posted',
  },
];

const marketplace = {
  name: CONFIG.marketplace.name,
  owner: CONFIG.marketplace.owner,
  description: CONFIG.marketplace.description,
  plugins,
};

const outputDir = join(ROOT, '.claude-plugin');
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'marketplace.json'), `${JSON.stringify(marketplace, null, 2)}\n`);

console.log(`Generated marketplace.json with ${plugins.length} plugins`);
