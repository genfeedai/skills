# Partnership Builder

Design partnership programs that multiply distribution through affiliates, integrations, resellers, co-marketing, or embedded channels.

## Installation

```bash
bunx skills add genfeedai/skills/partnership-builder
```

## Usage

```text
"Design an affiliate program for this product"
"Find partnership types that fit our SaaS"
"Create a co-marketing plan with adjacent tools"
"Build partner outreach for agencies serving our ICP"
```

## Boundary

- Use for partnership strategy, program structure, partner fit, and partner outreach planning.
- Use `outbound-optimizer` for the actual cold partner messages and sequences.
- Use `offer-architect` when the partner-specific offer or commission economics are unclear.

## What It Does

- Chooses between affiliate, integration, reseller, co-marketing, and embedded partnership models
- Checks readiness, tracking, margins, support requirements, and partner assets
- Defines commission models and partner enablement materials
- Identifies partner sources such as customers, tools, creators, agencies, and consultants

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed

## License

MIT
