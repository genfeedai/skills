import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MOTION = join(import.meta.dir, 'motion.ts');

const SRC = `
import { Img, staticFile } from 'remotion';
export const VisualComposition = () => (
  <div style={{ background: '#0b0b10', color: 'rgb(245, 245, 247)', fontFamily: 'Satoshi, sans-serif' }}>
    <Img src={staticFile('brand/logo.svg')} />
  </div>
);
`;

interface Overrides {
  brand?: Record<string, unknown>;
  src?: string;
}

function project(overrides: Overrides = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'motion-brand-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'public/brand'), { recursive: true });
  writeFileSync(join(root, 'src/VisualComposition.tsx'), overrides.src ?? SRC);
  writeFileSync(join(root, 'public/brand/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const script = {
    assets: [{ license: 'owned', path: 'public/brand/logo.svg', source: 'brand kit logo file' }],
    audience: 'Founders who post video',
    brand: {
      colors: [
        { hex: '#0b0b10', role: 'background' },
        { hex: '#f5f5f7', role: 'text' },
      ],
      fonts: ['Satoshi'],
      logo: 'public/brand/logo.svg',
      name: 'Genfeed',
      source: 'Genfeed brand context, read 2026-11-15',
      voice: 'Plain, confident, no hype',
      ...overrides.brand,
    },
    cta: 'Connect your agent',
    goal: 'Remember: from brief to feed',
    kind: 'editorial',
    shots: [
      { id: 'hook', onScreen: 'Brief to feed', seconds: 3, visual: 'drawn: big type' },
      { id: 'end', seconds: 2, visual: 'logo: public/brand/logo.svg' },
    ],
    title: 'Brand check',
    version: 1,
  };
  writeFileSync(join(root, 'script.json'), JSON.stringify(script));
  return root;
}

function validate(root: string): { errors: string[]; ok: boolean; warnings: string[] } {
  const result = spawnSync('bun', [MOTION, 'validate', root], { encoding: 'utf8' });
  return JSON.parse(result.stdout || result.stderr);
}

describe('brand block in script.json', () => {
  test('a complete brand block whose colors and font are used validates', () => {
    const result = validate(project());
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test('missing colors, fonts, voice and source are each an error', () => {
    const result = validate(project({ brand: { colors: [], fonts: [], source: '', voice: '' } }));
    expect(result.errors).toEqual([
      'brand.colors is empty: list the brand\'s real colors as { "hex": "#rrggbb", "role": "..." }',
      'brand.fonts is empty: name the brand font families',
      'brand.voice is empty: one line on tone, taken from the brand context',
      'brand.source is empty: say where the colors, fonts and voice came from (Genfeed get_brand_context, a brand kit file, the site)',
    ]);
  });

  test('a composition with a palette and font of its own is an error', () => {
    const src = SRC.replace('#0b0b10', '#123456')
      .replace('rgb(245, 245, 247)', 'white')
      .replace('Satoshi', 'Arial');
    expect(validate(project({ src })).errors).toEqual([
      'no brand color appears in src/: the composition uses a palette of its own',
      'no brand font appears in src/: the composition uses a font stack of its own',
    ]);
  });

  test('one unused brand color is only a warning', () => {
    const result = validate(
      project({
        brand: {
          colors: [
            { hex: '#0b0b10', role: 'background' },
            { hex: '#7c5cff', role: 'accent' },
          ],
        },
      })
    );
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(['brand color #7c5cff (accent) is not used in src/']);
  });

  test('a color that is not a hex and a color without a role are errors', () => {
    const result = validate(
      project({
        brand: {
          colors: [
            { hex: 'purple', role: 'accent' },
            { hex: '#0b0b10', role: '' },
          ],
        },
      })
    );
    expect(result.errors).toContain('brand.colors: "purple" is not a #rrggbb hex');
    expect(result.errors).toContain(
      'brand.colors: #0b0b10 needs a role (background, accent, text...)'
    );
  });
});
