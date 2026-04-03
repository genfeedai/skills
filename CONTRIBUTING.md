# Contributing to Genfeed Skills

Thanks for your interest in contributing! We welcome new skills and improvements to existing ones.

## Adding a New Skill

1. Fork the repository
2. Create a new directory: `your-skill-name/`
3. Add three files following the structure below
4. Run linters: `bun run check && bun run lint`
5. Submit a pull request

## Skill Structure

Every skill needs three files:

```
your-skill-name/
├── SKILL.md        # Main skill instructions
├── metadata.json   # Triggers, tags, metadata
└── README.md       # Documentation for skills.sh
```

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
---

# Your Skill Name

Instructions for the AI agent...
```

### metadata.json

```json
{
  "name": "your-skill-name",
  "version": "1.0.0",
  "description": "Short description",
  "author": "your-github-username",
  "license": "MIT",
  "triggers": ["trigger phrase 1", "trigger phrase 2"],
  "references": {},
  "outputs": ["text"],
  "tags": ["relevant", "tags"]
}
```

### README.md

Include: title, description, installation command, usage examples, and license.

## Quality Standards

- SKILL.md should be comprehensive (200+ lines) with tables, examples, and actionable frameworks
- Triggers in metadata.json should be natural phrases users would actually say
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
