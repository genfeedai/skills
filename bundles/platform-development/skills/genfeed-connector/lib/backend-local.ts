// Standalone backend — content factory state on the local filesystem.
//
// Layout (relative to the repo where skills run):
//   .genfeed/
//     ctx.json            resolved runtime context (written by detect.ts)
//     items/<id>.json     one ContentItem per file
//     artifacts/          generated media files (media-forge writes here)
//
// No database, no network. Survives only as long as the working directory does —
// which is exactly the standalone limitation the connected (api) backend removes.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Backend, JobFilter } from './adapter.ts';
import { STATE_DIR } from './detect.ts';
import { assertContentItem, type ContentItem, nowIso } from './schema.ts';

function itemsDir(cwd: string): string {
  return join(cwd, STATE_DIR, 'items');
}

export class LocalBackend implements Backend {
  readonly mode = 'standalone' as const;
  private readonly cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    mkdirSync(itemsDir(cwd), { recursive: true });
    mkdirSync(join(cwd, STATE_DIR, 'artifacts'), { recursive: true });
  }

  private path(id: string): string {
    return join(itemsDir(this.cwd), `${id}.json`);
  }

  saveItem(item: ContentItem): ContentItem {
    assertContentItem(item);
    const next = { ...item, updatedAt: nowIso() };
    writeFileSync(this.path(next.id), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    return next;
  }

  getItem(id: string): ContentItem | null {
    const p = this.path(id);
    if (!existsSync(p)) return null;
    const item = JSON.parse(readFileSync(p, 'utf8')) as ContentItem;
    assertContentItem(item);
    return item;
  }

  listItems(filter: JobFilter = {}): ContentItem[] {
    const dir = itemsDir(this.cwd);
    if (!existsSync(dir)) return [];
    const items = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ContentItem)
      .filter((it) => (filter.stage ? it.stage === filter.stage : true))
      .filter((it) => (filter.tag ? it.tags.includes(filter.tag) : true));
    items.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    return filter.limit ? items.slice(0, filter.limit) : items;
  }

  /**
   * Token resolution in standalone mode reads from the environment ONLY.
   * Secrets are never written to .genfeed or any file. Returns null if absent so
   * the caller can fail with a clear "set X_ACCESS_TOKEN" message.
   */
  getToken(platform: string): string | null {
    const envName = TOKEN_ENV[platform.toLowerCase()];
    if (!envName) return null;
    return process.env[envName] ?? null;
  }
}

/** Maps a platform to the env var a standalone user is expected to export. */
export const TOKEN_ENV: Record<string, string> = {
  x: 'X_BEARER_TOKEN',
  twitter: 'X_BEARER_TOKEN',
  linkedin: 'LINKEDIN_ACCESS_TOKEN',
  replicate: 'REPLICATE_API_TOKEN',
  fal: 'FAL_KEY',
  newsapi: 'NEWSAPI_KEY',
};
