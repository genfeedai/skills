import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  README_END,
  README_START,
  readSkillFields,
  renderMetadata,
  renderReadme,
  SkillFieldError,
} from './skill-files.js';

const FRONTMATTER = `---
name: demo-skill
description: The long description with trigger phrases.
license: MIT
metadata:
  author: genfeedai
  version: 1.2.0
  short-description: "Short listing copy"
  tags: demo, example
  outputs: text, markdown
  triggers: "make a demo; show me a demo"
  references: '{"notes":"references/notes.md"}'
  companions: helper-skill
---

# Demo Skill
`;

function skillWith(frontmatter) {
  const dir = mkdtempSync(join(tmpdir(), 'skill-files-'));
  mkdirSync(join(dir, 'demo-skill'));
  writeFileSync(join(dir, 'demo-skill', 'SKILL.md'), frontmatter);
  return { module: 'demo', name: 'demo-skill', dir: join(dir, 'demo-skill') };
}

describe('readSkillFields', () => {
  test('reads every generated field from the frontmatter', () => {
    expect(readSkillFields(skillWith(FRONTMATTER))).toEqual({
      name: 'demo-skill',
      description: 'The long description with trigger phrases.',
      license: 'MIT',
      author: 'genfeedai',
      version: '1.2.0',
      shortDescription: 'Short listing copy',
      triggers: ['make a demo', 'show me a demo'],
      outputs: ['text', 'markdown'],
      tags: ['demo', 'example'],
      references: { notes: 'references/notes.md' },
      companions: ['helper-skill'],
    });
  });

  test('names the skill and the field when a required field is missing', () => {
    const skill = skillWith(FRONTMATTER.replace(/^ {2}triggers:.*\n/m, ''));
    expect(() => readSkillFields(skill)).toThrow(
      'demo/demo-skill/SKILL.md: frontmatter is missing a text value for "metadata.triggers"'
    );
    expect(() => readSkillFields(skill)).toThrow(SkillFieldError);
  });
});

describe('renderMetadata', () => {
  test('keeps the metadata.json shape and takes the listing copy from short-description', () => {
    const parsed = JSON.parse(renderMetadata(readSkillFields(skillWith(FRONTMATTER))));
    expect(parsed).toEqual({
      name: 'demo-skill',
      version: '1.2.0',
      description: 'Short listing copy',
      author: 'genfeedai',
      license: 'MIT',
      triggers: ['make a demo', 'show me a demo'],
      references: { notes: 'references/notes.md' },
      outputs: ['text', 'markdown'],
      tags: ['demo', 'example'],
    });
    expect(Object.keys(parsed)).toEqual([
      'name',
      'version',
      'description',
      'author',
      'license',
      'triggers',
      'references',
      'outputs',
      'tags',
    ]);
  });
});

describe('renderReadme', () => {
  const fields = readSkillFields(skillWith(FRONTMATTER));

  test('creates a README for a skill that has none', () => {
    expect(renderReadme(null, fields)).toBe(`# Demo Skill

${README_START}
Short listing copy

## Installation

\`\`\`bash
bunx skills add genfeedai/skills --skill demo-skill helper-skill
\`\`\`
${README_END}
`);
  });

  test('adds the block under the title and keeps the hand-written sections', () => {
    const result = renderReadme('# My Title\n\n## Usage\n\nRun it.\n', fields);
    expect(result).toBe(`# My Title

${README_START}
Short listing copy

## Installation

\`\`\`bash
bunx skills add genfeedai/skills --skill demo-skill helper-skill
\`\`\`
${README_END}

## Usage

Run it.
`);
  });

  test('replaces a stale block and leaves the text around it alone', () => {
    const stale = `# My Title\n\n${README_START}\nOld summary\n${README_END}\n\n## Usage\n\nRun it.\n`;
    const result = renderReadme(stale, fields);
    expect(result).toContain('Short listing copy');
    expect(result).not.toContain('Old summary');
    expect(result.endsWith('\n\n## Usage\n\nRun it.\n')).toBe(true);
    expect(renderReadme(result, fields)).toBe(result);
  });
});
