// Shared plumbing for social-poster: the request model, the dry-run/live transport and
// the small helpers every publisher uses. Zero dependencies (Bun + global fetch only).
//
// Every publisher is written once against `Transport`. In a dry run the transport only
// records each request (with secrets masked) and hands back a placeholder response, so the
// dry run shows the *whole* request sequence a real run would make, and makes no network
// call. In a live run the same code path sends the requests.

import { statSync } from 'node:fs';

export type Platform =
  | 'x'
  | 'linkedin'
  | 'threads'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'mastodon';

export interface PostInput {
  /** Post body, caption or description. */
  text: string;
  /** Media references: https URLs or local file paths, depending on the platform. */
  media: string[];
  /** X only: already-uploaded media ids. */
  mediaIds: string[];
  /** Parsed CLI flags (string values; booleans arrive as 'true'). */
  flags: Record<string, string>;
}

export interface PostResult {
  posted: true;
  platform: Platform;
  postId?: string;
  url?: string;
  /** Platform-specific extras the orchestrator may want to record. */
  details?: Record<string, unknown>;
}

export interface FileSlice {
  path: string;
  /** First byte, inclusive. */
  start: number;
  /** Last byte, exclusive. */
  end: number;
}

export interface RequestSpec {
  /** Human label, shown in dry runs and errors. */
  step: string;
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers?: Record<string, string>;
  json?: unknown;
  /** application/x-www-form-urlencoded body. */
  form?: Record<string, string | string[]>;
  multipart?: {
    fields?: Record<string, string>;
    file?: { field: string; path: string; mime: string };
  };
  /** Raw binary body read from a local file. */
  file?: FileSlice;
  /** Statuses treated as success besides 2xx. */
  okStatuses?: number[];
}

export interface HttpResult {
  status: number;
  headers: Record<string, string>;
  json: Record<string, unknown>;
  text: string;
}

export interface Transport {
  readonly isDryRun: boolean;
  send(spec: RequestSpec, placeholder?: Record<string, unknown>): Promise<HttpResult>;
  sleep(ms: number): Promise<void>;
}

export interface Publisher {
  /** Environment variables that must hold secrets for a live run. */
  tokenEnv: string[];
  publish(input: PostInput, transport: Transport): Promise<PostResult>;
}

// ---------------------------------------------------------------------------
// Errors

export class PosterError extends Error {}

export function fail(message: string): never {
  throw new PosterError(message);
}

// ---------------------------------------------------------------------------
// Masking

const SECRET_KEY = /token|secret|password|authorization/i;

function maskValue(value: string): string {
  return value ? `****${value.slice(-4)}` : '(unset)';
}

/** "Bearer ****1234" — enough to tell which token without leaking it. */
function maskHeaderValue(value: string): string {
  const [scheme, ...rest] = value.split(' ');
  const cred = rest.join(' ');
  return cred ? `${scheme} ****${cred.slice(-4)}` : `${scheme} (unset)`;
}

function maskFields(fields: Record<string, string | string[]>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!SECRET_KEY.test(key)) out[key] = value;
    else out[key] = Array.isArray(value) ? value.map(maskValue) : maskValue(value);
  }
  return out;
}

/** Hide token-like query parameters (Meta Graph GET calls carry access_token in the URL). */
export function maskUrl(url: string): string {
  return url.replace(/([?&][^=&]*(?:token|secret|password)[^=&]*=)([^&]*)/gi, (_, key, value) => {
    let decoded = value;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      // keep the raw value; only its last four characters are shown
    }
    return `${key}${maskValue(decoded)}`;
  });
}

export function maskSpec(spec: RequestSpec): Record<string, unknown> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(spec.headers ?? {})) {
    headers[key] = key.toLowerCase() === 'authorization' ? maskHeaderValue(value) : value;
  }
  const out: Record<string, unknown> = {
    step: spec.step,
    method: spec.method,
    url: maskUrl(spec.url),
  };
  if (Object.keys(headers).length) out.headers = headers;
  if (spec.json !== undefined) out.body = spec.json;
  if (spec.form) out.form = maskFields(spec.form);
  if (spec.multipart) {
    out.multipart = {
      fields: maskFields(spec.multipart.fields ?? {}),
      file: spec.multipart.file,
    };
  }
  if (spec.file) {
    out.file = { path: spec.file.path, bytes: `${spec.file.start}-${spec.file.end - 1}` };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Transports

export class DryRunTransport implements Transport {
  readonly isDryRun = true;
  readonly planned: Record<string, unknown>[] = [];

  async send(spec: RequestSpec, placeholder: Record<string, unknown> = {}): Promise<HttpResult> {
    this.planned.push(maskSpec(spec));
    return { status: 200, headers: {}, json: placeholder, text: JSON.stringify(placeholder) };
  }

  async sleep(): Promise<void> {}
}

export class LiveTransport implements Transport {
  readonly isDryRun = false;

  async send(spec: RequestSpec): Promise<HttpResult> {
    const headers: Record<string, string> = { ...(spec.headers ?? {}) };
    let body: BodyInit | undefined;

    if (spec.json !== undefined) {
      headers['content-type'] ??= 'application/json';
      body = JSON.stringify(spec.json);
    } else if (spec.form) {
      headers['content-type'] ??= 'application/x-www-form-urlencoded';
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(spec.form)) {
        for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
      }
      body = params.toString();
    } else if (spec.multipart) {
      const form = new FormData();
      for (const [key, value] of Object.entries(spec.multipart.fields ?? {}))
        form.append(key, value);
      const file = spec.multipart.file;
      if (file) {
        form.append(
          file.field,
          Bun.file(file.path).slice(0, undefined, file.mime),
          basename(file.path)
        );
      }
      body = form;
    } else if (spec.file) {
      body = Bun.file(spec.file.path).slice(spec.file.start, spec.file.end);
    }

    let res: Response;
    try {
      res = await fetch(spec.url, { method: spec.method, headers, body });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return fail(`${spec.step} could not reach ${maskUrl(spec.url)}: ${maskUrl(reason)}`);
    }
    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });
    let json: Record<string, unknown> = {};
    try {
      const parsed: unknown = text ? JSON.parse(text) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        json = parsed as Record<string, unknown>;
      }
    } catch {
      // Non-JSON body: callers read `text`.
    }
    const ok = res.ok || (spec.okStatuses ?? []).includes(res.status);
    if (!ok) fail(`${spec.step} failed with ${res.status}: ${text.slice(0, 400)}`);
    return { status: res.status, headers: responseHeaders, json, text };
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Helpers

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function env(name: string): string {
  return process.env[name] ?? '';
}

export function bearer(tokenEnv: string): Record<string, string> {
  return { authorization: `Bearer ${env(tokenEnv)}` };
}

/** Read a string at `key`; nested lookups pass several keys. */
export function str(source: unknown, ...keys: string[]): string | undefined {
  let cursor: unknown = source;
  for (const key of keys) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  if (typeof cursor === 'string' && cursor) return cursor;
  if (typeof cursor === 'number') return String(cursor);
  return undefined;
}

export function requireId(value: string | undefined, step: string): string {
  if (!value) fail(`${step} returned no id`);
  return value;
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?.*)?$/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?.*)?$/i;

export function isVideoRef(ref: string): boolean {
  return VIDEO_EXT.test(ref);
}

export function isImageRef(ref: string): boolean {
  return IMAGE_EXT.test(ref);
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function mimeOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

/** Media for platforms that fetch from a public URL (Meta, Pinterest). */
export function requireUrls(platform: string, media: string[]): string[] {
  for (const ref of media) {
    if (!isHttpsUrl(ref)) {
      fail(
        `${platform} fetches media from a public https URL, got "${ref}". ` +
          'Host the file first (a CDN, or a Genfeed asset URL) and pass that URL with --media.'
      );
    }
  }
  return media;
}

/** Local file for platforms that take an upload. Returns its size in bytes. */
export function localFileSize(platform: string, path: string): number {
  if (isHttpsUrl(path)) {
    fail(
      `${platform} uploads a local file, got a URL: "${path}". Download it first or pass a path.`
    );
  }
  try {
    const stat = statSync(path);
    if (!stat.isFile()) fail(`${path} is not a file`);
    if (stat.size === 0) fail(`${path} is empty`);
    return stat.size;
  } catch (err) {
    if (err instanceof PosterError) throw err;
    fail(`${platform}: cannot read media file "${path}"`);
  }
}

export function flag(input: PostInput, name: string, envName?: string): string {
  return input.flags[name] ?? (envName ? env(envName) : '');
}

export function hasFlag(input: PostInput, name: string): boolean {
  return input.flags[name] === 'true';
}

export function requireFlag(input: PostInput, name: string, envName: string, what: string): string {
  const value = flag(input, name, envName);
  if (!value) fail(`${what} is required (pass --${name} or set ${envName})`);
  return value;
}

export function pollSettings(input: PostInput): { intervalMs: number; maxAttempts: number } {
  const seconds = Number(input.flags['poll-seconds'] ?? 30);
  const intervalMs = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 30_000;
  return { intervalMs, maxAttempts: Math.max(1, Number(input.flags['poll-attempts'] ?? 10) || 10) };
}

/**
 * Poll `check` until it returns a value. In a dry run the check is recorded once and the
 * placeholder is used, so no waiting happens.
 */
export async function poll<T>(
  transport: Transport,
  input: PostInput,
  check: () => Promise<{ done: boolean; value?: T }>,
  timeoutMessage: string
): Promise<T | undefined> {
  const { intervalMs, maxAttempts } = pollSettings(input);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await check();
    if (outcome.done) return outcome.value;
    if (transport.isDryRun) return outcome.value;
    if (attempt < maxAttempts) await transport.sleep(intervalMs);
  }
  return fail(timeoutMessage);
}
