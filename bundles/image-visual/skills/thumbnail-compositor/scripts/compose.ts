#!/usr/bin/env bun
/**
 * thumbnail-compositor: composite three branded thumbnail variants (backdrop,
 * text, signature) with a local Chrome or Chromium. No API calls, no npm packages.
 *
 *   bun run scripts/compose.ts --spec thumbs.json [--out out/thumbs] [--scale 1] [--dry-run]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Mode = 'livestream' | 'recap' | 'short';
type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface Signature {
  corner: Corner;
  file: string;
  insetRatio: number;
  widthRatio: number;
}

interface Profile {
  accent: string;
  dark: string;
  fontFamily: string;
  fontFile?: string;
  light: string;
  maxWords: number;
  signature?: Signature;
  uppercase: boolean;
  version: string;
}

interface Variant {
  accentWord?: string;
  backdropFile?: string;
  backdropGradient?: [string, string];
  hypothesis: string;
  name: string;
  scrim?: number;
  text?: string[];
}

interface Spec {
  mode: Mode;
  profile: Partial<Profile>;
  variants: Variant[];
}

const BASE = {
  livestream: { height: 720, width: 1280 },
  recap: { height: 720, width: 1280 },
  short: { height: 1920, width: 1080 },
} as const;

const DEFAULT_PROFILE: Profile = {
  accent: '#7c5cff',
  dark: '#0b0b10',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  light: '#f5f5f7',
  maxWords: 4,
  uppercase: true,
  version: 'unversioned',
};

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/pw-browsers/chromium/chrome-linux64/chrome',
  '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  join(homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'),
];

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message: string): never {
  process.stderr.write(`thumbnail-compositor: ${message}\n`);
  process.exit(1);
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

function safeFont(value: string | undefined, fallback: string): string {
  return value && /^[\w\s,'"-]+$/.test(value) ? value : fallback;
}

function fileUrl(path: string): string {
  const full = resolve(path);
  if (!existsSync(full)) fail(`file not found: ${full}`);
  return pathToFileURL(full).href;
}

function findChrome(): string {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return fail('no Chrome or Chromium found. Install one or set CHROME_PATH.');
}

/** Words as the viewer counts them: split on whitespace, ignore empties. */
function wordCount(lines: string[]): number {
  return lines.join(' ').split(/\s+/).filter(Boolean).length;
}

function signatureCss(sig: Signature, width: number): string {
  const size = Math.round(sig.widthRatio * width);
  const inset = Math.round(sig.insetRatio * width);
  const vertical = sig.corner.startsWith('top') ? `top:${inset}px` : `bottom:${inset}px`;
  const horizontal = sig.corner.endsWith('left') ? `left:${inset}px` : `right:${inset}px`;
  return `position:absolute;${vertical};${horizontal};width:${size}px;height:auto`;
}

function page(
  variant: Variant,
  profile: Profile,
  width: number,
  height: number,
  previewScale: number
): string {
  const backdrop = variant.backdropFile
    ? `url('${fileUrl(variant.backdropFile)}') center / cover no-repeat`
    : `linear-gradient(135deg, ${safeColor(variant.backdropGradient?.[0], profile.dark)}, ${safeColor(variant.backdropGradient?.[1], '#1a1a24')})`;
  const scrim = Math.min(Math.max(variant.scrim ?? 0.35, 0), 0.9);
  const fontFace = profile.fontFile
    ? `@font-face{font-family:'BrandFont';src:url('${fileUrl(profile.fontFile)}');}`
    : '';
  const family = profile.fontFile ? `'BrandFont', ${profile.fontFamily}` : profile.fontFamily;
  const lines = (variant.text ?? []).map((line) => {
    const shown = profile.uppercase ? line.toUpperCase() : line;
    const safe = esc(shown);
    if (!variant.accentWord) return safe;
    const accent = esc(profile.uppercase ? variant.accentWord.toUpperCase() : variant.accentWord);
    return safe.split(accent).join(`<span class="accent">${accent}</span>`);
  });
  const textBlock = lines.length
    ? `<div class="text">${lines.map((line) => `<div>${line}</div>`).join('')}</div>`
    : '';
  const sig = profile.signature
    ? `<img alt="" src="${fileUrl(profile.signature.file)}" style="${signatureCss(profile.signature, width)}">`
    : '';
  const fontSize = width > height ? Math.round(width * 0.115) : Math.round(width * 0.17);
  const margin = Math.round(width * 0.06);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${width * previewScale}px;height:${height * previewScale}px;overflow:hidden;background:${profile.dark}}
.canvas{position:relative;width:${width}px;height:${height}px;background:${backdrop};transform:scale(${previewScale});transform-origin:0 0;font-family:${family};overflow:hidden}
.scrim{position:absolute;inset:0;background:rgba(0,0,0,${scrim})}
.text{position:absolute;left:${margin}px;right:${margin}px;bottom:${margin}px;color:${profile.light};font-weight:900;line-height:1.02;letter-spacing:-.01em;font-size:${fontSize}px;text-shadow:0 4px 24px rgba(0,0,0,.5)}
.accent{color:${profile.accent}}
</style></head><body><div class="canvas"><div class="scrim"></div>${textBlock}${sig}</div></body></html>`;
}

function shot(
  binary: string,
  html: string,
  out: string,
  width: number,
  height: number,
  scale: number,
  tmp: string
): void {
  writeFileSync(tmp, html);
  const result = spawnSync(
    binary,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--force-device-scale-factor=${scale}`,
      `--screenshot=${out}`,
      `--window-size=${width},${height}`,
      pathToFileURL(tmp).href,
    ],
    { encoding: 'utf8', timeout: 120_000 }
  );
  rmSync(tmp, { force: true });
  if (result.status !== 0) fail(`chrome exited ${result.status}: ${result.stderr.slice(0, 300)}`);
}

function main(): void {
  const specPath = arg('spec');
  if (!specPath) fail('--spec <file.json> is required');
  const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8')) as Spec;
  if (!(spec.mode in BASE)) fail('mode must be livestream, recap or short');
  if (!Array.isArray(spec.variants) || spec.variants.length !== 3) {
    fail('exactly three variants are required: three different hypotheses, one true promise');
  }
  const base = spec.profile ?? {};
  const profile: Profile = {
    ...DEFAULT_PROFILE,
    ...base,
    accent: safeColor(base.accent, DEFAULT_PROFILE.accent),
    dark: safeColor(base.dark, DEFAULT_PROFILE.dark),
    fontFamily: safeFont(base.fontFamily, DEFAULT_PROFILE.fontFamily),
    light: safeColor(base.light, DEFAULT_PROFILE.light),
  };
  const problems: string[] = [];
  for (const variant of spec.variants) {
    if (!variant.name || !variant.hypothesis)
      problems.push('every variant needs a name and a hypothesis');
    const lines = variant.text ?? [];
    if (lines.length > 2) problems.push(`${variant.name}: at most 2 lines of text`);
    if (wordCount(lines) > profile.maxWords) {
      problems.push(
        `${variant.name}: ${wordCount(lines)} words, the profile allows ${profile.maxWords}`
      );
    }
    if (
      variant.accentWord &&
      !lines.join(' ').toLowerCase().includes(variant.accentWord.toLowerCase())
    ) {
      problems.push(`${variant.name}: accentWord is not in the text`);
    }
  }
  if (problems.length) fail(problems.join('; '));

  const { width, height } = BASE[spec.mode];
  const scale = Math.min(Math.max(Number(arg('scale') ?? 1), 1), 3);
  const out = resolve(arg('out') ?? 'thumbnail-out');
  const letters = ['a', 'b', 'c'];
  const plan = spec.variants.map((variant, index) => ({
    export: `variant-${letters[index]}.png`,
    exportSize: `${width * scale}x${height * scale}`,
    name: variant.name,
    preview: `variant-${letters[index]}.small.png`,
  }));
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, mode: spec.mode, plan }, null, 2)}\n`);
    return;
  }

  const binary = findChrome();
  mkdirSync(out, { recursive: true });
  // The small preview mimics the related-videos size: 168 px wide for 16:9.
  const previewWidth = width > height ? 168 : 94;
  const previewScale = previewWidth / width;
  const previewHeight = Math.round(height * previewScale);
  spec.variants.forEach((variant, index) => {
    const tag = letters[index];
    shot(
      binary,
      page(variant, profile, width, height, 1),
      join(out, `variant-${tag}.png`),
      width,
      height,
      scale,
      join(out, `.${tag}.html`)
    );
    shot(
      binary,
      page(variant, profile, width, height, previewScale),
      join(out, `variant-${tag}.small.png`),
      previewWidth,
      previewHeight,
      1,
      join(out, `.${tag}-small.html`)
    );
  });

  const manifest = {
    fonts: profile.fontFile ? ['BrandFont (file)'] : [profile.fontFamily],
    mode: spec.mode,
    profileVersion: profile.version,
    renderedAt: new Date().toISOString(),
    variants: spec.variants.map((variant, index) => ({
      ...plan[index],
      hypothesis: variant.hypothesis,
      text: variant.text ?? null,
    })),
  };
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main();
