#!/usr/bin/env bun
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
/**
 * threejs-previs: author a stick-figure and coloured-block mockup of a video as JSON, render it
 * locally to a reference video, and draft the prompt that maps every colour to what it represents.
 * Local Chrome and ffmpeg only. No model API. The one npm package is three.js (pinned in runtime/).
 *
 *   bun run scripts/previs.ts setup
 *   bun run scripts/previs.ts init <dir> [--template chase|street-taxi]
 *   bun run scripts/previs.ts validate <scene.json> [--target seedance-2.0]
 *   bun run scripts/previs.ts render <scene.json> [--out out] [--target seedance-2.0] [--no-review]
 *   bun run scripts/previs.ts prompt <scene.json> [--target seedance-2.0] [--ref-style byteplus|replicate|fal]
 *                                    [--video-index 1] [--first-image-index 1] [--out prompt.md]
 *   bun run scripts/previs.ts check <video.mp4> [--target seedance-2.0]
 */
import { type Subprocess, spawn, spawnSync } from 'bun';
import {
  colorNameOf,
  draftPrompt,
  legendOf,
  REF_STYLES,
  type RefStyle,
  type Scene,
  TARGETS,
  type Target,
  validateScene,
} from './scene';

const SKILL_DIR = resolve(import.meta.dir, '..');

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

function fail(message: string): never {
  process.stderr.write(`threejs-previs: ${message}\n`);
  process.exit(1);
}

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function targetOf(): Target | undefined {
  const id = arg('target');
  if (!id) return undefined;
  const target = TARGETS[id];
  if (!target) fail(`unknown --target "${id}". Use one of: ${Object.keys(TARGETS).join(', ')}`);
  return target;
}

function loadScene(path: string | undefined): Scene {
  if (!path) fail('give the scene.json path');
  if (!existsSync(path)) fail(`${path} does not exist`);
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Scene;
  } catch (error) {
    return fail(`${path} is not valid JSON: ${(error as Error).message}`);
  }
}

function report(scene: Scene, target?: Target): void {
  const { errors, warnings } = validateScene(scene, target);
  for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`error: ${error}\n`);
    process.exit(1);
  }
}

function findChrome(): string {
  const found = CHROME_CANDIDATES.find((path) => path && existsSync(path));
  return found ?? fail('Chrome or Chromium was not found. Install it or set CHROME_PATH.');
}

// ---------- minimal DevTools client ----------

interface Pending {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
}

class Cdp {
  private id = 0;
  private pending = new Map<number, Pending>();

  private constructor(private socket: WebSocket) {
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as {
        error?: { message: string };
        id?: number;
        result?: unknown;
      };
      if (message.id === undefined) return;
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      if (message.error) waiting.reject(new Error(message.error.message));
      else waiting.resolve(message.result);
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((done, error) => {
      socket.addEventListener('open', () => done());
      socket.addEventListener('error', () =>
        error(new Error('could not open the DevTools socket'))
      );
    });
    return new Cdp(socket);
  }

  send<T = unknown>(method: string, params: object = {}): Promise<T> {
    const id = ++this.id;
    return new Promise<T>((resolvePromise, reject) => {
      this.pending.set(id, { reject, resolve: resolvePromise as (value: unknown) => void });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send<{
      exceptionDetails?: { exception?: { description?: string }; text: string };
      result: { value: T };
    }>('Runtime.evaluate', { awaitPromise: true, expression, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text
      );
    }
    return result.result.value;
  }

  close(): void {
    this.socket.close();
  }
}

async function bundlePage(workDir: string): Promise<string> {
  const three = join(SKILL_DIR, 'runtime/node_modules/three');
  if (!existsSync(three)) fail('three.js is not installed. Run: bun run scripts/previs.ts setup');
  const built = await Bun.build({
    entrypoints: [join(SKILL_DIR, 'scripts/page.ts')],
    minify: false,
    plugins: [
      {
        name: 'three-from-runtime',
        setup(build) {
          build.onResolve({ filter: /^three$/ }, () => ({
            path: join(three, 'build/three.module.js'),
          }));
        },
      },
    ],
    target: 'browser',
  });
  if (!built.success) fail(`could not bundle the render page:\n${built.logs.join('\n')}`);
  const js = await built.outputs[0].text();
  const html = join(workDir, 'page.html');
  writeFileSync(join(workDir, 'page.js'), js);
  writeFileSync(
    html,
    '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}canvas{display:block}</style><body><script src="page.js"></script></body>'
  );
  return html;
}

async function launchChrome(
  workDir: string,
  width: number,
  height: number
): Promise<{ chrome: Subprocess; cdp: Cdp }> {
  const profile = join(workDir, 'profile');
  mkdirSync(profile, { recursive: true });
  const chrome = spawn(
    [
      findChrome(),
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stderr: 'ignore', stdout: 'ignore' }
  );
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await Bun.sleep(100);
  if (!existsSync(portFile)) {
    chrome.kill();
    fail('Chrome did not start');
  }
  const port = readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
    type: string;
    webSocketDebuggerUrl: string;
  }[];
  const page = targets.find((target) => target.type === 'page');
  if (!page) {
    chrome.kill();
    fail('Chrome opened no page');
  }
  return { cdp: await Cdp.connect(page.webSocketDebuggerUrl), chrome };
}

async function renderVideo(cdp: Cdp, scene: Scene, review: boolean, output: string): Promise<void> {
  const { fps, durationSeconds } = scene.canvas;
  const frames = Math.round(durationSeconds * fps);
  await cdp.evaluate(`window.previs.init(${JSON.stringify(scene)}, ${review})`);
  const ffmpeg = spawn(
    [
      'ffmpeg',
      '-y',
      '-loglevel',
      'error',
      '-f',
      'image2pipe',
      '-framerate',
      String(fps),
      '-i',
      '-',
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '14',
      '-pix_fmt',
      'yuv420p',
      '-r',
      String(fps),
      '-an',
      '-movflags',
      '+faststart',
      output,
    ],
    { stderr: 'pipe', stdin: 'pipe' }
  );
  for (let i = 0; i < frames; i++) {
    const url = await cdp.evaluate<string>(`window.previs.frame(${i})`);
    ffmpeg.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  }
  await ffmpeg.stdin.end();
  const code = await ffmpeg.exited;
  if (code !== 0) fail(`ffmpeg failed: ${await new Response(ffmpeg.stderr).text()}`);
}

function sheet(video: string, output: string, seconds: number): void {
  const result = spawnSync([
    'ffmpeg',
    '-y',
    '-loglevel',
    'error',
    '-i',
    video,
    '-vf',
    `fps=8/${seconds},scale=-1:420,tile=8x1`,
    '-frames:v',
    '1',
    output,
  ]);
  if (result.exitCode !== 0) fail(`ffmpeg could not build the sheet: ${result.stderr.toString()}`);
}

// ---------- commands ----------

interface Probed {
  bytes: number;
  fps: number;
  height: number;
  seconds: number;
  width: number;
}

function probe(path: string): Probed {
  const result = spawnSync([
    'ffprobe',
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,r_frame_rate,duration:format=duration,size',
    '-of',
    'json',
    path,
  ]);
  if (result.exitCode !== 0) fail(`ffprobe failed on ${path}: ${result.stderr.toString()}`);
  const json = JSON.parse(result.stdout.toString()) as {
    format: { duration?: string; size?: string };
    streams: { height: number; r_frame_rate: string; width: number }[];
  };
  const stream = json.streams[0];
  const [num, den] = stream.r_frame_rate.split('/').map(Number);
  return {
    bytes: Number(json.format.size ?? 0),
    fps: den ? num / den : num,
    height: stream.height,
    seconds: Number(json.format.duration ?? 0),
    width: stream.width,
  };
}

function checkVideo(path: string, target?: Target): string[] {
  const info = probe(path);
  process.stdout.write(
    `${path}: ${info.width}x${info.height}, ${info.fps} fps, ${info.seconds.toFixed(2)} s, ${(info.bytes / 1e6).toFixed(1)} MB\n`
  );
  const problems: string[] = [];
  if (!target) return problems;
  const pixels = info.width * info.height;
  const aspect = info.width / info.height;
  if (pixels < target.pixels[0] || pixels > target.pixels[1])
    problems.push(`${pixels} px is outside ${target.pixels.join(' to ')}`);
  if (aspect < 0.4 || aspect > 2.5)
    problems.push(`aspect ratio ${aspect.toFixed(2)} is outside 0.4 to 2.5`);
  if (info.fps < target.fps[0] || info.fps > target.fps[1])
    problems.push(`${info.fps} fps is outside ${target.fps.join(' to ')}`);
  if (info.seconds < target.eachSeconds[0] || info.seconds > target.eachSeconds[1])
    problems.push(`${info.seconds.toFixed(2)} s is outside ${target.eachSeconds.join(' to ')} s`);
  if (info.bytes > target.maxMegabytes * 1e6)
    problems.push(`${(info.bytes / 1e6).toFixed(0)} MB is over ${target.maxMegabytes} MB`);
  return problems;
}

function setup(): void {
  const result = spawnSync(['bun', 'install', '--cwd', join(SKILL_DIR, 'runtime')], {
    stderr: 'inherit',
    stdout: 'inherit',
  });
  process.exit(result.exitCode ?? 1);
}

const TEMPLATES = ['chase', 'street-taxi'];

function init(dir: string | undefined): void {
  if (!dir) fail('give a folder, for example: init ./my-previs');
  const template = arg('template') ?? 'chase';
  if (!TEMPLATES.includes(template))
    fail(`unknown --template "${template}". Use one of: ${TEMPLATES.join(', ')}`);
  mkdirSync(dir, { recursive: true });
  const target = join(dir, 'scene.json');
  if (existsSync(target)) fail(`${target} already exists`);
  copyFileSync(join(SKILL_DIR, `templates/${template}.scene.json`), target);
  process.stdout.write(`wrote ${target}\n`);
}

async function render(): Promise<void> {
  const scenePath = process.argv[3];
  const scene = loadScene(scenePath);
  const target = targetOf();
  report(scene, target);
  const out = resolve(arg('out') ?? join(dirname(resolve(scenePath)), 'out'));
  mkdirSync(out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'previs-'));
  try {
    const html = await bundlePage(work);
    const { cdp, chrome } = await launchChrome(work, scene.canvas.width, scene.canvas.height);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        deviceScaleFactor: 1,
        height: scene.canvas.height,
        mobile: false,
        width: scene.canvas.width,
      });
      await cdp.send('Page.navigate', { url: `file://${html}` });
      for (let i = 0; i < 100; i++) {
        if (await cdp.evaluate<boolean>('typeof window.previs === "object"')) break;
        await Bun.sleep(100);
      }
      const clean = join(out, 'previs.mp4');
      await renderVideo(cdp, scene, false, clean);
      process.stdout.write(`wrote ${clean}\n`);
      if (!flag('no-review')) {
        await cdp.evaluate('document.body.replaceChildren()');
        const review = join(out, 'previs-review.mp4');
        await renderVideo(cdp, scene, true, review);
        process.stdout.write(`wrote ${review}\n`);
        sheet(review, join(out, 'previs-sheet.png'), scene.canvas.durationSeconds);
        process.stdout.write(`wrote ${join(out, 'previs-sheet.png')}\n`);
      }
    } finally {
      cdp.close();
      chrome.kill();
    }
    writeFileSync(join(out, 'legend.json'), `${JSON.stringify(legendOf(scene), null, 2)}\n`);
    process.stdout.write(`wrote ${join(out, 'legend.json')}\n`);
    const problems = checkVideo(join(out, 'previs.mp4'), target);
    if (problems.length > 0) {
      for (const problem of problems) process.stderr.write(`error: ${problem}\n`);
      process.exit(1);
    }
  } finally {
    rmSync(work, { force: true, recursive: true });
  }
}

function prompt(): void {
  const scene = loadScene(process.argv[3]);
  report(scene, targetOf());
  const style = (arg('ref-style') ?? 'byteplus') as RefStyle;
  if (!REF_STYLES.includes(style)) fail(`--ref-style must be one of: ${REF_STYLES.join(', ')}`);
  const draft = draftPrompt(scene, {
    firstImageIndex: Number(arg('first-image-index') ?? 1),
    style,
    videoIndex: Number(arg('video-index') ?? 1),
  });
  const lines = [
    '# Prompt draft',
    '',
    '## Reference inputs, in this order',
    '',
    `- Video ${arg('video-index') ?? 1}: the rendered \`previs.mp4\` (not \`previs-review.mp4\`: its labels would leak into the result).`,
    ...draft.images.map(
      (image) =>
        `- Image ${image.index}: ${image.entity.reference} (for ${image.entity.label}, the ${colorNameOf(image.entity)} ${image.entity.kind})`
    ),
    '',
    '## Prompt',
    '',
    '```text',
    draft.prompt,
    '```',
    '',
    ...draft.warnings.map((warning) => `> ${warning}`),
    '',
  ];
  const text = lines.join('\n');
  const out = arg('out');
  if (out) {
    writeFileSync(out, text);
    process.stdout.write(`wrote ${out}\n`);
  } else {
    process.stdout.write(text);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case 'setup':
      return setup();
    case 'init':
      return init(process.argv[3]);
    case 'validate': {
      const scene = loadScene(process.argv[3]);
      report(scene, targetOf());
      process.stdout.write('scene is valid\n');
      return;
    }
    case 'render':
      return render();
    case 'prompt':
      return prompt();
    case 'check': {
      if (!process.argv[3]) fail('give the video path');
      const problems = checkVideo(process.argv[3], targetOf());
      for (const problem of problems) process.stderr.write(`error: ${problem}\n`);
      if (problems.length > 0) process.exit(1);
      return;
    }
    default:
      fail('commands: setup, init, validate, render, prompt, check');
  }
}

await main();
