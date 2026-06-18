// The seam. Loop skills depend on this facade, never on a concrete backend.
// `getAdapter()` resolves the mode once and returns a uniform async API whether
// state lives on the local filesystem (standalone) or in genfeed.ai (connected).

import { resolveContext } from './detect.ts';
import {
  type ContentItem,
  type HistoryEntry,
  type Metric,
  type Mode,
  makeContentItem,
  nowIso,
  type RuntimeContext,
  type Stage,
} from './schema.ts';

export interface JobFilter {
  stage?: Stage;
  tag?: string;
  limit?: number;
}

/** Storage contract. Methods may be sync (local) or async (api); the facade awaits both. */
export interface Backend {
  readonly mode: Mode;
  saveItem(item: ContentItem): ContentItem | Promise<ContentItem>;
  getItem(id: string): (ContentItem | null) | Promise<ContentItem | null>;
  listItems(filter?: JobFilter): ContentItem[] | Promise<ContentItem[]>;
  getToken(platform: string): (string | null) | Promise<string | null>;
}

/**
 * Engagement → a single 0..1 feedback score for one item. Used to (a) rank which
 * themes to double down on and (b) attribute performance back to trend terms.
 * Heuristic, deliberately simple: weighted interactions over impressions.
 */
export function computeFeedbackScore(metrics: Metric[]): number {
  if (metrics.length === 0) return 0;
  let interactions = 0;
  let impressions = 0;
  for (const m of metrics) {
    interactions +=
      (m.likes ?? 0) + 2 * (m.comments ?? 0) + 3 * (m.shares ?? 0) + 2 * (m.clicks ?? 0);
    impressions += m.impressions ?? 0;
  }
  if (impressions === 0) {
    // No impression data — fall back to a saturating function of raw interactions.
    return Math.min(1, interactions / 100);
  }
  const rate = interactions / impressions;
  // Engagement rates above ~10% are exceptional; map that onto ~1.0.
  return Math.min(1, rate / 0.1);
}

export class Gf {
  readonly ctx: RuntimeContext;
  private readonly backend: Backend;

  constructor(backend: Backend, ctx: RuntimeContext) {
    this.backend = backend;
    this.ctx = ctx;
  }

  get mode(): Mode {
    return this.ctx.mode;
  }

  async createItem(partial: Partial<ContentItem> = {}): Promise<ContentItem> {
    return this.backend.saveItem(makeContentItem(partial));
  }

  async saveItem(item: ContentItem): Promise<ContentItem> {
    return this.backend.saveItem(item);
  }

  async getItem(id: string): Promise<ContentItem | null> {
    return this.backend.getItem(id);
  }

  async listItems(filter: JobFilter = {}): Promise<ContentItem[]> {
    return this.backend.listItems(filter);
  }

  /** Oldest item currently sitting in `stage` — the next unit of work for a loop driver. */
  async nextJob(stage: Stage): Promise<ContentItem | null> {
    const items = await this.backend.listItems({ stage, limit: 1 });
    return items[0] ?? null;
  }

  /** Advance an item to a new stage, appending an audit entry. */
  async transition(id: string, to: Stage, note?: string): Promise<ContentItem> {
    const item = await this.backend.getItem(id);
    if (!item) throw new Error(`transition: item ${id} not found`);
    const entry: HistoryEntry = { at: nowIso(), from: item.stage, to, note };
    const next: ContentItem = { ...item, stage: to, history: [...item.history, entry] };
    return this.backend.saveItem(next);
  }

  /** Append a metric snapshot and recompute the item's feedback score. */
  async recordMetric(id: string, metric: Metric): Promise<ContentItem> {
    const item = await this.backend.getItem(id);
    if (!item) throw new Error(`recordMetric: item ${id} not found`);
    const metrics = [...item.metrics, metric];
    const next: ContentItem = { ...item, metrics, feedbackScore: computeFeedbackScore(metrics) };
    return this.backend.saveItem(next);
  }

  /**
   * Loop closure: average feedback score across all measured items tagged with `term`.
   * trend-scout multiplies a fresh trend's raw score by (1 + this) so themes that
   * performed before float to the top of the next cycle.
   */
  async feedbackForTerm(term: string): Promise<number> {
    const measured = await this.backend.listItems({ stage: 'measured' });
    const tagged = measured.filter(
      (it) => it.tags.includes(term) && typeof it.feedbackScore === 'number'
    );
    if (tagged.length === 0) return 0;
    const sum = tagged.reduce((acc, it) => acc + (it.feedbackScore ?? 0), 0);
    return sum / tagged.length;
  }

  /** Resolve a platform token. Standalone: from env. Connected: short-lived from the vault. */
  async getToken(platform: string): Promise<string | null> {
    return this.backend.getToken(platform);
  }
}

/** Build the adapter for the current working directory, resolving mode (cached). */
export async function getAdapter(cwd: string = process.cwd(), force?: Mode): Promise<Gf> {
  const ctx = resolveContext(cwd, force);
  let backend: Backend;
  if (ctx.mode === 'api') {
    const { ApiBackend } = await import('./backend-api.ts');
    backend = new ApiBackend(ctx);
  } else {
    const { LocalBackend } = await import('./backend-local.ts');
    backend = new LocalBackend(cwd);
  }
  return new Gf(backend, ctx);
}
