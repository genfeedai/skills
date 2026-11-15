/**
 * Shared logic for generating each skill's README.md header and metadata.json from its
 * SKILL.md frontmatter. SKILL.md is the single source for name, version, description,
 * triggers, outputs, tags and references; the generated parts carry no hand edits.
 *
 * Frontmatter fields the generator reads (all values are strings, as the Agent Skills
 * spec requires of `metadata`):
 *
 *   name, description, license
 *   metadata.author, metadata.version
 *   metadata.short-description   short listing copy for metadata.json and the README summary
 *   metadata.triggers            phrases users say, separated by ";"
 *   metadata.outputs             comma-separated output kinds
 *   metadata.tags                comma-separated tags
 *   metadata.references          optional, a JSON object of reference files
 *   metadata.companions          optional, comma-separated skills installed with this one
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const README_START =
  '<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->';
export const README_END = '<!-- generated:end -->';

export class SkillFieldError extends Error {}

export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) throw new SkillFieldError('SKILL.md has no YAML frontmatter');
  try {
    return Bun.YAML.parse(match[1]) ?? {};
  } catch (error) {
    throw new SkillFieldError(`SKILL.md frontmatter does not parse (${error.message})`);
  }
}

function requireString(source, field, value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new SkillFieldError(`${source}: frontmatter is missing a text value for "${field}"`);
  }
  return value.trim();
}

function toList(source, field, value, separator) {
  const items = Array.isArray(value)
    ? value.map(String)
    : requireString(source, field, value).split(separator);
  const list = items.map((item) => item.trim()).filter(Boolean);
  if (list.length === 0) throw new SkillFieldError(`${source}: "${field}" has no entries`);
  return list;
}

function toReferences(source, value) {
  if (value === undefined || value === null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // falls through to the error below
  }
  throw new SkillFieldError(`${source}: "metadata.references" must be a JSON object`);
}

/** The fields generated files are built from. Throws SkillFieldError naming the skill and field. */
export function readSkillFields(skill) {
  const source = `${skill.module}/${skill.name}/SKILL.md`;
  let front;
  try {
    front = parseFrontmatter(readFileSync(join(skill.dir, 'SKILL.md'), 'utf8'));
  } catch (error) {
    throw new SkillFieldError(`${source}: ${error.message}`);
  }
  const meta = front.metadata && typeof front.metadata === 'object' ? front.metadata : {};
  return {
    name: requireString(source, 'name', front.name),
    description: requireString(source, 'description', front.description),
    license: requireString(source, 'license', front.license),
    author: requireString(source, 'metadata.author', meta.author),
    version: requireString(source, 'metadata.version', meta.version),
    shortDescription: requireString(
      source,
      'metadata.short-description',
      meta['short-description']
    ),
    triggers: toList(source, 'metadata.triggers', meta.triggers, ';'),
    outputs: toList(source, 'metadata.outputs', meta.outputs, ','),
    tags: toList(source, 'metadata.tags', meta.tags, ','),
    references: toReferences(source, meta.references),
    companions: meta.companions ? toList(source, 'metadata.companions', meta.companions, ',') : [],
  };
}

export function renderMetadata(fields) {
  return `${JSON.stringify(
    {
      name: fields.name,
      version: fields.version,
      description: fields.shortDescription,
      author: fields.author,
      license: fields.license,
      triggers: fields.triggers,
      references: fields.references,
      outputs: fields.outputs,
      tags: fields.tags,
    },
    null,
    2
  )}\n`;
}

export function renderReadmeBlock(fields) {
  const install = ['genfeedai/skills', '--skill', fields.name, ...fields.companions].join(' ');
  return [
    README_START,
    fields.shortDescription,
    '',
    '## Installation',
    '',
    '```bash',
    `bunx skills add ${install}`,
    '```',
    README_END,
  ].join('\n');
}

function titleFromName(name) {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Replace the generated block in an existing README, or add it under the title. */
export function renderReadme(existing, fields) {
  const block = renderReadmeBlock(fields);
  if (existing === null) return `# ${titleFromName(fields.name)}\n\n${block}\n`;
  const start = existing.indexOf(README_START);
  const end = existing.indexOf(README_END);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + README_END.length);
  }
  const lines = existing.split('\n');
  const titleIndex = lines.findIndex((line) => line.startsWith('# '));
  if (titleIndex === -1) return `# ${titleFromName(fields.name)}\n\n${block}\n\n${existing}`;
  const rest = lines
    .slice(titleIndex + 1)
    .join('\n')
    .replace(/^\n+/, '');
  return `${lines.slice(0, titleIndex + 1).join('\n')}\n\n${block}\n${rest ? `\n${rest}` : ''}`;
}
