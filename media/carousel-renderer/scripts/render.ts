#!/usr/bin/env bun
/**
 * carousel-renderer: turn a slide spec (JSON) into branded PNG slides and a PDF
 * using a locally installed Chrome or Chromium. No API calls, no npm packages.
 *
 *   bun run scripts/render.ts --spec carousel.json [--out out/carousel] [--dry-run]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type SlideType = 'cover' | 'content' | 'quote' | 'stat' | 'cta';

interface Brand {
  accent: string;
  background: string;
  fontFamily: string;
  fontFile?: string;
  foreground: string;
  handle: string;
  muted: string;
  name: string;
}

interface Slide {
  body?: string;
  bullets?: string[];
  caption?: string;
  eyebrow?: string;
  stat?: string;
  title?: string;
  type: SlideType;
}

interface Spec {
  brand?: Partial<Brand>;
  format?: 'instagram' | 'linkedin' | 'square';
  slides: Slide[];
}

const SIZES = {
  instagram: { height: 1350, width: 1080 },
  linkedin: { height: 1350, width: 1080 },
  square: { height: 1080, width: 1080 },
} as const;

const MAX_SLIDES = { instagram: 20, linkedin: 300, square: 20 } as const;

const DEFAULT_BRAND: Brand = {
  accent: '#7c5cff',
  background: '#0b0b10',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  foreground: '#f5f5f7',
  handle: '',
  muted: '#9a9aa8',
  name: '',
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
  process.stderr.write(`carousel-renderer: ${message}\n`);
  process.exit(1);
}

function esc(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeColor(value: string, fallback: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) || /^(rgb|hsl)a?\([\d\s.,%/]+\)$/.test(value)
    ? value
    : fallback;
}

function safeFont(value: string, fallback: string): string {
  return /^[\w\s,'"-]+$/.test(value) ? value : fallback;
}

function titleSize(text: string | undefined, base: number): number {
  const length = (text ?? '').length;
  if (length > 90) return Math.round(base * 0.6);
  if (length > 60) return Math.round(base * 0.75);
  if (length > 30) return Math.round(base * 0.9);
  return base;
}

function slideHtml(slide: Slide, index: number, total: number, brand: Brand): string {
  const bullets = (slide.bullets ?? []).map((item) => `<li>${esc(item)}</li>`).join('');
  const eyebrow = slide.eyebrow ? `<p class="eyebrow">${esc(slide.eyebrow)}</p>` : '';
  const body = slide.body ? `<p class="body">${esc(slide.body)}</p>` : '';
  const list = bullets ? `<ul>${bullets}</ul>` : '';
  const caption = slide.caption ? `<p class="caption">${esc(slide.caption)}</p>` : '';
  const base = slide.type === 'cover' ? 104 : slide.type === 'stat' ? 64 : 76;
  const title = slide.title
    ? `<h1 style="font-size:${titleSize(slide.title, base)}px">${esc(slide.title)}</h1>`
    : '';
  const stat = slide.type === 'stat' && slide.stat ? `<p class="stat">${esc(slide.stat)}</p>` : '';
  const footer = `<footer><span>${esc(brand.handle || brand.name)}</span><span>${index + 1} / ${total}</span></footer>`;
  return `<section class="slide ${slide.type}">${eyebrow}${stat}${title}${body}${list}${caption}${footer}</section>`;
}

function buildHtml(spec: Spec, brand: Brand, width: number, height: number): string {
  const fontFace = brand.fontFile
    ? `@font-face{font-family:'BrandFont';src:url('${pathToFileURL(resolve(brand.fontFile)).href}');}`
    : '';
  const family = brand.fontFile ? `'BrandFont', ${brand.fontFamily}` : brand.fontFamily;
  const total = spec.slides.length;
  const slides = spec.slides
    .map((slide, index) => slideHtml(slide, index, total, brand))
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
@page{size:${width}px ${height}px;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${brand.background};-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:${family};color:${brand.foreground}}
.slide{position:relative;width:${width}px;height:${height}px;padding:96px 88px 140px;display:flex;flex-direction:column;justify-content:center;gap:36px;background:${brand.background};page-break-after:always;overflow:hidden}
.slide::before{content:'';position:absolute;left:88px;top:72px;width:96px;height:10px;border-radius:5px;background:${brand.accent}}
.eyebrow{font-size:30px;letter-spacing:.14em;text-transform:uppercase;color:${brand.accent};font-weight:700}
h1{font-weight:800;line-height:1.08;letter-spacing:-.02em}
.body{font-size:44px;line-height:1.35;color:${brand.foreground}}
ul{list-style:none;display:flex;flex-direction:column;gap:26px}
li{font-size:42px;line-height:1.3;padding-left:56px;position:relative}
li::before{content:'';position:absolute;left:0;top:.45em;width:24px;height:24px;border-radius:50%;background:${brand.accent}}
.caption{font-size:32px;color:${brand.muted}}
.stat{font-size:220px;line-height:1;font-weight:900;color:${brand.accent};letter-spacing:-.04em}
.quote h1{font-weight:600;font-style:italic}
.cover{justify-content:flex-end}
.cta{align-items:flex-start}
footer{position:absolute;left:88px;right:88px;bottom:64px;display:flex;justify-content:space-between;font-size:28px;color:${brand.muted}}
</style></head><body>
${slides}
</body></html>`;
}

function findChrome(): string {
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return fail('no Chrome or Chromium found. Install one or set CHROME_PATH to its binary.');
}

function chrome(binary: string, flags: string[]): void {
  const result = spawnSync(
    binary,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--allow-file-access-from-files',
      ...flags,
    ],
    { encoding: 'utf8', timeout: 120_000 }
  );
  if (result.status !== 0) {
    fail(`chrome exited ${result.status}: ${result.stderr.slice(0, 400)}`);
  }
}

function main(): void {
  const specPath = arg('spec');
  if (!specPath) fail('--spec <file.json> is required');
  const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8')) as Spec;
  if (!Array.isArray(spec.slides) || spec.slides.length < 2) {
    fail('spec.slides needs at least 2 slides');
  }
  const format = spec.format ?? 'instagram';
  if (!(format in SIZES)) fail(`unknown format "${format}"`);
  if (spec.slides.length > MAX_SLIDES[format]) {
    fail(`${format} allows at most ${MAX_SLIDES[format]} slides`);
  }
  const { width, height } = SIZES[format];
  const merged = { ...DEFAULT_BRAND, ...spec.brand };
  const brand: Brand = {
    ...merged,
    accent: safeColor(merged.accent, DEFAULT_BRAND.accent),
    background: safeColor(merged.background, DEFAULT_BRAND.background),
    fontFamily: safeFont(merged.fontFamily, DEFAULT_BRAND.fontFamily),
    foreground: safeColor(merged.foreground, DEFAULT_BRAND.foreground),
    muted: safeColor(merged.muted, DEFAULT_BRAND.muted),
  };
  const out = resolve(arg('out') ?? 'carousel-out');
  const dryRun = process.argv.includes('--dry-run');

  const files = spec.slides.map((_, index) => `slide-${String(index + 1).padStart(2, '0')}.png`);
  const plan = { files, format, height, out, pdf: 'carousel.pdf', width };
  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, ...plan }, null, 2)}\n`);
    return;
  }

  const binary = findChrome();
  mkdirSync(out, { recursive: true });
  const htmlPath = join(out, 'carousel.html');
  writeFileSync(htmlPath, buildHtml(spec, brand, width, height));

  // One page per slide: render each by hiding the others via a URL fragment-free
  // per-slide HTML file, so the screenshot is exactly one slide.
  spec.slides.forEach((slide, index) => {
    const single = { ...spec, slides: [slide] };
    const html = buildHtml(single, brand, width, height).replace(
      `1 / 1`,
      `${index + 1} / ${spec.slides.length}`
    );
    const page = join(out, `.slide-${index + 1}.html`);
    writeFileSync(page, html);
    chrome(binary, [
      `--screenshot=${join(out, files[index] as string)}`,
      `--window-size=${width},${height}`,
      pathToFileURL(page).href,
    ]);
    rmSync(page);
  });

  chrome(binary, [
    '--no-pdf-header-footer',
    `--print-to-pdf=${join(out, 'carousel.pdf')}`,
    pathToFileURL(htmlPath).href,
  ]);

  const manifest = {
    ...plan,
    renderedAt: new Date().toISOString(),
    slides: spec.slides.length,
  };
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main();
