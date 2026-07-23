// Mode detection — the orchestrator probe.
//
// Decides whether the content factory runs `standalone` (local filesystem state,
// env-only tokens, manual scheduling) or `api` (genfeed.ai owns state, tokens,
// scheduling, analytics callbacks, and the approval UI).
//
// Detection order (first hit wins):
//   1. GENFEED_API_KEY env set                 -> api
//   2. `genfeed status` CLI exits 0 on PATH    -> api
//   3. .genfeed/config.json declares an apiKeyEnv whose env var is set -> api
//   4. otherwise                               -> standalone
//
// The resolved context is cached to .genfeed/ctx.json. It NEVER stores a secret
// value — only the NAME of the env var that holds the key.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Mode, nowIso, type RuntimeContext } from './schema.ts';

const STATE_DIR = '.genfeed';
const CTX_FILE = join(STATE_DIR, 'ctx.json');
const CONFIG_FILE = join(STATE_DIR, 'config.json');
const DEFAULT_API_BASE = 'https://api.genfeed.ai';

interface GenfeedConfig {
  apiKeyEnv?: string; // name of env var holding the key
  apiBaseUrl?: string;
}

function root(cwd: string, file: string): string {
  return join(cwd, file);
}

function readConfig(cwd: string): GenfeedConfig {
  const path = root(cwd, CONFIG_FILE);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GenfeedConfig;
  } catch {
    return {};
  }
}

function genfeedCliHealthy(): boolean {
  try {
    // `genfeed status` is expected to exit 0 when a key is configured in the CLI keychain.
    execFileSync('genfeed', ['status'], { stdio: 'ignore', timeout: 4000 });
    return true;
  } catch {
    return false;
  }
}

const CONNECTED_CAPS: RuntimeContext['capabilities'] = {
  persistentState: true,
  scheduling: true,
  tokenVault: true,
  analyticsWebhook: true,
  approvalUi: true,
};

const STANDALONE_CAPS: RuntimeContext['capabilities'] = {
  persistentState: false,
  scheduling: false,
  tokenVault: false,
  analyticsWebhook: false,
  approvalUi: false,
};

/**
 * Resolve the runtime mode. Pass `force` to override detection (useful for tests
 * and for `gf detect --mode standalone`).
 */
export function detect(cwd: string = process.cwd(), force?: Mode): RuntimeContext {
  const config = readConfig(cwd);
  const apiBaseUrl = config.apiBaseUrl ?? DEFAULT_API_BASE;

  let mode: Mode = 'standalone';
  let apiKeyEnv: string | undefined;

  if (force) {
    mode = force;
    if (force === 'api') apiKeyEnv = config.apiKeyEnv ?? 'GENFEED_API_KEY';
  } else if (process.env.GENFEED_API_KEY) {
    mode = 'api';
    apiKeyEnv = 'GENFEED_API_KEY';
  } else if (config.apiKeyEnv && process.env[config.apiKeyEnv]) {
    mode = 'api';
    apiKeyEnv = config.apiKeyEnv;
  } else if (genfeedCliHealthy()) {
    mode = 'api';
    apiKeyEnv = config.apiKeyEnv; // CLI holds the key in its own keychain; may be undefined here
  }

  const ctx: RuntimeContext = {
    mode,
    resolvedAt: nowIso(),
    capabilities: mode === 'api' ? CONNECTED_CAPS : STANDALONE_CAPS,
    apiBaseUrl: mode === 'api' ? apiBaseUrl : undefined,
    apiKeyEnv,
  };
  return ctx;
}

/** Resolve once and cache to .genfeed/ctx.json. Re-resolves if the cache is missing. */
export function resolveContext(cwd: string = process.cwd(), force?: Mode): RuntimeContext {
  const ctxPath = root(cwd, CTX_FILE);
  if (!force && existsSync(ctxPath)) {
    try {
      return JSON.parse(readFileSync(ctxPath, 'utf8')) as RuntimeContext;
    } catch {
      // fall through to re-detect on a corrupt cache
    }
  }
  const ctx = detect(cwd, force);
  mkdirSync(dirname(ctxPath), { recursive: true });
  writeFileSync(ctxPath, `${JSON.stringify(ctx, null, 2)}\n`, 'utf8');
  return ctx;
}

export { DEFAULT_API_BASE, STATE_DIR };
