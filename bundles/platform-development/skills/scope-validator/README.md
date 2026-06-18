# Scope Validator

Classify Genfeed feature requests as OSS Core or Cloud SaaS scope and explain the correct next action.

## Installation

```bash
bunx skills add genfeedai/skills/scope-validator
```

## Usage

```text
"Should social publishing be in core or cloud?"
"Can I contribute an RSS input node to core?"
"Is FAL.ai provider support in scope for OSS?"
"Triage this feature request against Genfeed scope"
```

## Boundary

- Use for product-scope triage between Genfeed OSS Core and Cloud SaaS.
- Use `node-creator` when a core-compatible custom node should actually be designed or implemented.
- Use `onboarding` when the user is new and needs to understand the product, not scope a feature.

## What It Does

- Checks node types, providers, templates, and feature requests against Core vs Cloud rules
- Explains why a feature belongs in OSS Core or Cloud SaaS
- Gives contributor or subscription next steps
- Keeps social publishing, feed ingestion, and multi-provider cloud features out of OSS scope

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
