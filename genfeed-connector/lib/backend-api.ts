// Connected backend — genfeed.ai owns the durable state, the OAuth token vault,
// scheduling, and analytics callbacks. Same Backend interface as LocalBackend so
// loop skills are identical in either mode.
//
// REST contract (genfeed.ai content-factory API):
//   GET    {base}/v1/content-items?stage=&tag=&limit=
//   GET    {base}/v1/content-items/{id}
//   PUT    {base}/v1/content-items/{id}
//   POST   {base}/v1/tokens/{platform}/issue   -> { token, expiresAt }  (short-lived, scoped)
//
// The API key is read from the env var named by ctx.apiKeyEnv (never persisted here).
// Platform tokens are fetched on demand, used in-memory by the caller, and never
// written to disk — the vault + refresh live entirely server-side.

import type { Backend, JobFilter } from './adapter.ts';
import { assertContentItem, type ContentItem, type RuntimeContext } from './schema.ts';

export class ApiBackend implements Backend {
  readonly mode = 'api' as const;
  private readonly base: string;
  private readonly apiKey: string;

  constructor(ctx: RuntimeContext) {
    if (!ctx.apiBaseUrl) throw new Error('ApiBackend requires ctx.apiBaseUrl');
    const envName = ctx.apiKeyEnv ?? 'GENFEED_API_KEY';
    const key = process.env[envName];
    if (!key) {
      throw new Error(
        `Connected mode resolved but ${envName} is not set. ` +
          'Export the genfeed API key or run `genfeed login`.'
      );
    }
    this.base = ctx.apiBaseUrl.replace(/\/$/, '');
    this.apiKey = key;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`genfeed API ${init.method ?? 'GET'} ${path} -> ${res.status} ${body}`);
    }
    return (await res.json()) as T;
  }

  saveItem(item: ContentItem): Promise<ContentItem> {
    assertContentItem(item);
    return this.req<ContentItem>(`/v1/content-items/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  }

  async getItem(id: string): Promise<ContentItem | null> {
    try {
      const item = await this.req<ContentItem>(`/v1/content-items/${id}`);
      assertContentItem(item);
      return item;
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) return null;
      throw err;
    }
  }

  listItems(filter: JobFilter = {}): Promise<ContentItem[]> {
    const qs = new URLSearchParams();
    if (filter.stage) qs.set('stage', filter.stage);
    if (filter.tag) qs.set('tag', filter.tag);
    if (filter.limit) qs.set('limit', String(filter.limit));
    const query = qs.toString();
    return this.req<ContentItem[]>(`/v1/content-items${query ? `?${query}` : ''}`);
  }

  /**
   * Issue a short-lived, platform-scoped token from the genfeed vault. The server
   * handles OAuth storage + refresh; we never see the long-lived credential.
   */
  async getToken(platform: string): Promise<string | null> {
    const out = await this.req<{ token: string; expiresAt: string }>(
      `/v1/tokens/${encodeURIComponent(platform)}/issue`,
      { method: 'POST' }
    );
    return out.token ?? null;
  }
}
