# Contributing to Genfeed Skills

Thanks for your interest in contributing! We welcome new skills and improvements to existing ones.

## Requirements

Contributing needs Bun and Node 24 or newer. CI runs on Node 26 (see `.node-version`). Installing skills with `bunx skills add` has no Node requirement from this repo.

## Adding a New Skill

1. Fork the repository
2. Create a new directory in the right module: `<module>/your-skill-name/` (see `scripts/modules.json`; add a module there only for a new platform or discipline)
3. Add three files following the structure below
4. Run linters: `bun run check && bun run lint`
5. Submit a pull request

## Skill Structure

Every skill needs three files:

```
<module>/
└── your-skill-name/
    ├── SKILL.md        # Main skill instructions
    ├── metadata.json   # Generated from SKILL.md, do not edit
    └── README.md       # Documentation for skills.sh; the header block is generated
```

The folder name must equal the `name` in the frontmatter. Run `bun run validate` to regenerate `.claude-plugin/marketplace.json` and check the layout.

### SKILL.md

Use YAML frontmatter:

```yaml
---
name: your-skill-name
description: What this skill does and trigger phrases
license: MIT
metadata:
  author: your-github-username
  version: "1.0.0"
  short-description: Short listing copy, one sentence
  tags: relevant, tags
  outputs: text
  triggers: "trigger phrase 1; trigger phrase 2"
---

# Your Skill Name

Instructions for the AI agent...
```

The `metadata` values are strings: `tags` and `outputs` are comma-separated, `triggers` are separated by `;`. Optional fields are `references` (a JSON object as a string) and `companions` (skills installed with this one, comma-separated). `short-description` is the listing copy; keep it short and keep the long text in `description`.

### metadata.json and README.md

Do not write `metadata.json` by hand. Run `bun run skills:generate` after editing `SKILL.md`; it writes `metadata.json` and the generated header of `README.md` (the summary and install command between the `generated:start` and `generated:end` comments). Everything else in `README.md` is yours: usage examples, what the skill does, structure and limits. `bun run validate` fails and names the skill when a generated file is out of date, and the pre-commit hook regenerates them for you.

## Quality Standards

- SKILL.md should be comprehensive (200+ lines) with tables, examples, and actionable frameworks
- Triggers in the `SKILL.md` frontmatter should be natural phrases users would actually say
- Tags should be relevant for discoverability on skills.sh
- All markdown must pass `markdownlint`
- All JSON must pass `biome check`

## Genfeed Integration

If your skill can benefit from Genfeed platform tools, add a "Genfeed Integration" section to your SKILL.md explaining how the skill uses platform tools when available. Skills should always work standalone without Genfeed.

## Running Linters

```bash
bun install
bun run check    # Biome (JSON formatting)
bun run lint     # Markdownlint (Markdown formatting)
```

## Pull Request Process

1. Branch from `master`: `git checkout -b feat/your-skill-name`
2. Make your changes
3. Run linters
4. Push and open a PR
5. Wait for CI to pass and a review

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
