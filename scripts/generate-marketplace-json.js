#!/usr/bin/env bun
/**
 * Generate Claude Marketplace metadata for Genfeed bundle plugins.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATEGORIES = JSON.parse(readFileSync(join(__dirname, 'plugin-categories.json'), 'utf-8'));

function getBundleEntries() {
  return {
    all: {
      description:
        'All Genfeed skills for content creation, GTM strategy, advertising, workflow development, and onboarding',
    },
    ...CATEGORIES.bundles,
  };
}

const plugins = Object.entries(getBundleEntries()).map(([category, config]) => ({
  name: `genfeedai-${category}`,
  source: `./bundles/${category}`,
  description: config.description,
}));

const marketplace = {
  name: CATEGORIES.marketplace.name,
  owner: CATEGORIES.marketplace.owner,
  description: CATEGORIES.marketplace.description,
  plugins,
};

const outputDir = join(ROOT, '.claude-plugin');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

const outputPath = join(outputDir, 'marketplace.json');
writeFileSync(outputPath, `${JSON.stringify(marketplace, null, 2)}\n`);

console.log(`Generated marketplace.json with ${plugins.length} bundle plugins`);
