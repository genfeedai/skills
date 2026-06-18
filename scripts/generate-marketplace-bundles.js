#!/usr/bin/env bun
/**
 * Generate Claude Marketplace bundle plugin directories.
 *
 * Bundles are plugin snapshots copied from the root skill directories. Source
 * skill folders intentionally stay plugin-manifest-free.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BUNDLES_DIR = join(ROOT, 'bundles');
const CATEGORIES = JSON.parse(readFileSync(join(__dirname, 'plugin-categories.json'), 'utf-8'));

const IGNORED_SKILL_DIRS = new Set([
  '.claude-plugin',
  '.git',
  '.github',
  '.husky',
  'bundles',
  'node_modules',
  'scripts',
]);

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getAllSkillNames() {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !IGNORED_SKILL_DIRS.has(name))
    .filter((name) => existsSync(join(ROOT, name, 'SKILL.md')))
    .sort();
}

function generatePluginJson(name, description) {
  return `${JSON.stringify(
    {
      name,
      version: '1.0.0',
      description,
      author: 'genfeedai',
      license: 'MIT',
      skills: {
        path: './skills',
      },
    },
    null,
    2
  )}\n`;
}

function generateReadme(category, description, skills) {
  const title = category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const skillList = skills.map((skill) => `- \`${skill}\``).join('\n');

  return `# Genfeed Skills - ${title} Bundle

${description}

## Installation

\`\`\`bash
/plugin marketplace add genfeedai/skills
/plugin install genfeedai-${category}@genfeedai
\`\`\`

## Included Skills

${skillList}
`;
}

function getBundleEntries() {
  const allSkills = getAllSkillNames();
  return {
    all: {
      description:
        'All Genfeed skills for content creation, GTM strategy, advertising, workflow development, and onboarding',
      skills: allSkills,
    },
    ...CATEGORIES.bundles,
  };
}

console.log('Generating Genfeed marketplace bundles...\n');

if (existsSync(BUNDLES_DIR)) {
  rmSync(BUNDLES_DIR, { recursive: true });
}
ensureDir(BUNDLES_DIR);

const missingSkills = [];
const bundles = getBundleEntries();

for (const [category, config] of Object.entries(bundles)) {
  const bundleDir = join(BUNDLES_DIR, category);
  const skillsDir = join(bundleDir, 'skills');

  console.log(`Creating bundle: ${category} (${config.skills.length} skills)`);
  ensureDir(skillsDir);

  for (const skillName of config.skills) {
    const sourceSkill = join(ROOT, skillName);
    const destinationSkill = join(skillsDir, skillName);

    if (!existsSync(join(sourceSkill, 'SKILL.md'))) {
      missingSkills.push(`${category}:${skillName}`);
      continue;
    }

    cpSync(sourceSkill, destinationSkill, { recursive: true });
  }

  writeFileSync(
    join(bundleDir, 'plugin.json'),
    generatePluginJson(`genfeedai-${category}`, config.description)
  );
  writeFileSync(
    join(bundleDir, 'README.md'),
    generateReadme(category, config.description, config.skills)
  );
}

if (missingSkills.length > 0) {
  console.error('\nMissing skills in scripts/plugin-categories.json:');
  for (const missing of missingSkills) {
    console.error(`  - ${missing}`);
  }
  process.exit(1);
}

console.log(`\nGenerated ${Object.keys(bundles).length} bundles in: ${BUNDLES_DIR}`);
