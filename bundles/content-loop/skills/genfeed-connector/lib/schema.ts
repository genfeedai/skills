// Content factory manifest schema — the single source of truth for an item as it
// moves through the locked loop: trend -> remix -> produce -> approve -> post -> measure -> repeat.
//
// Pure types + lightweight runtime validators (no external deps so the skill installs
// with zero `bun add`). Both the local backend and the genfeed API backend serialize
// to and from these shapes.

import { randomUUID } from 'node:crypto';

/** Lifecycle stages. A ContentItem advances through these via gf.transition(). */
export const STAGES = [
  'trend_candidate', // emitted by trend-scout, not yet selected
  'selected', // a human/orchestrator picked it to produce
  'briefed', // flagship thesis + brief attached
  'remixed', // atomized into platform derivatives
  'producing', // media/copy generation in flight
  'awaiting_approval', // drafts complete, needs human gate before posting
  'approved', // cleared to publish
  'scheduled', // queued for a future publish time
  'posted', // live on at least one platform
  'measured', // analytics collected
  'archived', // done, retained for learning
  'killed', // rejected, retained for learning
] as const;

export type Stage = (typeof STAGES)[number];

export type Platform =
  | 'x'
  | 'linkedin'
  | 'newsletter'
  | 'instagram'
  | 'youtube'
  | 'blog'
  | 'tiktok';

export type Modality = 'image' | 'video' | 'audio';
export type MediaProvider = 'replicate' | 'fal';

/** A single trend observation from one source. score is normalized 0..1. */
export interface TrendSignal {
  source: string; // 'google-trends' | 'reddit' | 'hackernews' | 'rss' | 'newsapi'
  term: string;
  score: number; // 0..1 normalized rank within its source
  volume?: number; // raw volume/points/comments where available
  url?: string;
  capturedAt: string; // ISO 8601
}

/** One platform-native derivative of the flagship asset. */
export interface Derivative {
  platform: Platform;
  format: string; // 'thread' | 'post' | 'article' | 'caption' | 'script' | 'edition'
  copy?: string;
  mediaRefs: string[]; // MediaArtifact.id values attached to this derivative
  status: 'draft' | 'approved' | 'posted' | 'failed';
  postId?: string; // platform-assigned id once posted
  postedAt?: string; // ISO 8601
  error?: string;
}

/** A generated media asset (image/video/audio) and where it lives. */
export interface MediaArtifact {
  id: string;
  modality: Modality;
  provider: MediaProvider;
  model: string; // provider model slug, e.g. 'black-forest-labs/flux-1.1-pro'
  prompt: string;
  path: string; // local file path (standalone) or genfeed asset URL (connected)
  meta?: Record<string, unknown>;
}

/** A performance snapshot for one posted derivative. */
export interface Metric {
  platform: Platform;
  postId: string;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  capturedAt: string; // ISO 8601
}

/** A single stage transition, for audit + loop replay. */
export interface HistoryEntry {
  at: string; // ISO 8601
  from: Stage | null;
  to: Stage;
  note?: string;
}

/** The manifest row. Everything about one content item lives here. */
export interface ContentItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage: Stage;
  trend?: TrendSignal;
  thesis?: string; // the flagship angle / weekly point of view
  brief?: string; // production brief
  derivatives: Derivative[];
  artifacts: MediaArtifact[];
  metrics: Metric[];
  feedbackScore?: number; // derived from metrics; feeds next trend ranking (loop closure)
  history: HistoryEntry[];
  tags: string[]; // pillars, themes, trend terms — used to attribute analytics back to trends
}

export type Mode = 'standalone' | 'api';

/** Resolved runtime context, cached to .genfeed/ctx.json. Never contains secret values. */
export interface RuntimeContext {
  mode: Mode;
  resolvedAt: string;
  capabilities: {
    persistentState: boolean; // survives across runs/machines
    scheduling: boolean; // always-on cron owned by genfeed
    tokenVault: boolean; // OAuth tokens stored + refreshed by genfeed
    analyticsWebhook: boolean; // inbound callback receiver
    approvalUi: boolean; // human approval surface
  };
  apiBaseUrl?: string; // connected mode only
  apiKeyEnv?: string; // NAME of the env var holding the key — never the key itself
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = 'ci'): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

/** Construct a fresh ContentItem with sane defaults. */
export function makeContentItem(partial: Partial<ContentItem> = {}): ContentItem {
  const ts = nowIso();
  const stage: Stage = partial.stage ?? 'trend_candidate';
  return {
    id: partial.id ?? newId(),
    createdAt: partial.createdAt ?? ts,
    updatedAt: ts,
    stage,
    trend: partial.trend,
    thesis: partial.thesis,
    brief: partial.brief,
    derivatives: partial.derivatives ?? [],
    artifacts: partial.artifacts ?? [],
    metrics: partial.metrics ?? [],
    feedbackScore: partial.feedbackScore,
    history: partial.history ?? [{ at: ts, from: null, to: stage }],
    tags: partial.tags ?? [],
  };
}

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

/**
 * Minimal structural validation. Throws on the fields the loop relies on so a
 * corrupt manifest fails loudly instead of silently dropping items.
 */
export function assertContentItem(value: unknown): asserts value is ContentItem {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('ContentItem must be an object');
  }
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) {
    throw new TypeError('ContentItem.id must be a non-empty string');
  }
  if (!isStage(v.stage)) {
    throw new TypeError(`ContentItem.stage is invalid: ${String(v.stage)}`);
  }
  if (!Array.isArray(v.derivatives) || !Array.isArray(v.artifacts) || !Array.isArray(v.metrics)) {
    throw new TypeError('ContentItem.derivatives/artifacts/metrics must be arrays');
  }
}
