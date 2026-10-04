#!/usr/bin/env bun
/**
 * Validate the Genfeed plugin bundle at plugins/genfeed.
 *
 * One folder serves two formats: Agent Plugins 1.0 (plugin.json + mcp.json)
 * and a Claude plugin (.claude-plugin/plugin.json + .mcp.json). Both share
 * skills/ and assets/. This checks that the two stay consistent.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PLUGIN = join(ROOT, 'plugins', 'genfeed');
// The plugin bundles the full toolset; the directory connector keeps the bare URL.
const MCP_URL = 'https://mcp.genfeed.ai/mcp?profile=full';

const issues = [];
const fail = (message) => issues.push(message);

function readJson(relativePath) {
  const path = join(PLUGIN, relativePath);
  if (!existsSync(path)) {
    fail(`missing ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${relativePath}: invalid JSON (${error.message})`);
    return null;
  }
}

const portable = readJson('plugin.json');
const claude = readJson('.claude-plugin/plugin.json');
const portableMcp = readJson('mcp.json');
const claudeMcp = readJson('.mcp.json');

if (existsSync(join(PLUGIN, 'LISTING.md'))) {
  const listing = readFileSync(join(PLUGIN, 'LISTING.md'), 'utf8');
  if (/\{[a-z]\['|\$\{/.test(listing)) fail('LISTING.md contains unfilled template placeholders');
}

for (const required of ['README.md', 'LICENSE', 'LISTING.md']) {
  if (!existsSync(join(PLUGIN, required))) fail(`missing ${required}`);
}

if (portable && claude) {
  if (portable.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') {
    fail('plugin.json: $schema must be the Agent Plugins 1.0.0 plugin schema');
  }
  for (const field of ['name', 'version', 'license']) {
    if (portable[field] !== claude[field]) {
      fail(`${field} differs between plugin.json and .claude-plugin/plugin.json`);
    }
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(portable.name ?? '') || portable.name.length > 64) {
    fail('plugin name must be lowercase letters, digits and hyphens, at most 64 characters');
  }
}

if (portable) {
  const ui = portable.extensions?.['com.openai']?.interface;
  if (!ui) {
    fail('plugin.json: missing extensions["com.openai"].interface');
  } else {
    const limits = { displayName: 30, shortDescription: 30, longDescription: 4000 };
    for (const [field, max] of Object.entries(limits)) {
      if (typeof ui[field] !== 'string' || ui[field].length === 0 || ui[field].length > max) {
        fail(`interface.${field} must be 1 to ${max} characters`);
      }
    }
    if (!Array.isArray(ui.defaultPrompt) || ui.defaultPrompt.length > 3) {
      fail('interface.defaultPrompt must have at most 3 prompts');
    }
    for (const prompt of ui.defaultPrompt ?? []) {
      if (prompt.length > 128) fail(`defaultPrompt over 128 characters: ${prompt}`);
    }
    for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL', 'supportURL']) {
      if (!ui[field]?.startsWith('https://')) fail(`interface.${field} must be an https URL`);
    }
    const assetPaths = [ui.composerIcon, ui.logo, ...(ui.screenshots ?? [])].filter(Boolean);
    for (const assetPath of assetPaths) {
      if (!existsSync(join(PLUGIN, assetPath))) fail(`interface asset not found: ${assetPath}`);
    }
  }
}

for (const [label, mcp, type] of [
  ['mcp.json', portableMcp, 'streamable-http'],
  ['.mcp.json', claudeMcp, 'http'],
]) {
  const server = mcp?.mcpServers?.genfeed;
  if (!server) fail(`${label}: missing mcpServers.genfeed`);
  else if (server.url !== MCP_URL || server.type !== type) {
    fail(`${label}: genfeed server must be type ${type} at ${MCP_URL}`);
  }
}

const skillsDir = join(PLUGIN, 'skills');
const skillNames = existsSync(skillsDir)
  ? readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
if (skillNames.length === 0) fail('skills/ has no skills');

for (const name of skillNames) {
  const file = join(skillsDir, name, 'SKILL.md');
  if (!existsSync(file)) {
    fail(`skills/${name}: missing SKILL.md`);
    continue;
  }
  const text = readFileSync(file, 'utf8');
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
  const declared = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (declared !== name) fail(`skills/${name}: frontmatter name must equal the folder name`);
  if (!description.startsWith('Use when')) {
    fail(`skills/${name}: description must start with "Use when" and name the user's situation`);
  }
  if (/: | #/.test(description)) {
    fail(`skills/${name}: description has ": " or " #", which breaks plain YAML; reword it`);
  }
  if (description.length > 1024) fail(`skills/${name}: description over 1024 characters`);
  if (!/never publish|never schedule|no send tool|only reads|never saves/i.test(text)) {
    fail(`skills/${name}: must state its no-publish-without-confirmation rule`);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
for (const file of walk(PLUGIN)) {
  if (/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/.test(file))
    fail(`system file in plugin: ${file}`);
  if (statSync(file).size > 5 * 1024 * 1024) fail(`file over 5 MiB: ${file}`);
}

if (issues.length > 0) {
  console.error(issues.map((issue) => `plugins/genfeed: ${issue}`).join('\n'));
  process.exit(1);
}

console.log(`   OK: plugins/genfeed (${skillNames.length} skills, 2 manifest formats in sync)`);
