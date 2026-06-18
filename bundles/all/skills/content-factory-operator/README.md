# Content Factory Operator

Design the operating system for a repeatable Genfeed content factory: intake, research, briefs, production, review, publishing, and analytics.

## Installation

```bash
bunx skills add genfeedai/skills/content-factory-operator
```

## Usage

```text
"Build a Genfeed content factory for a B2B SaaS client"
"Design an AI content agency retainer around Genfeed.ai"
"Create a weekly content production system for my founder brand"
"Turn customer call transcripts into a content pipeline"
```

## Boundary

- Use for the system design behind recurring content operations and agency delivery.
- Use `content-strategist` for the editorial strategy layer: audience, pillars, platform roles, cadence, calendar, and KPIs.
- Use `content-loop-orchestrator` when the user wants to run the executable Genfeed loop or inspect loop state.

## What It Does

- Defines source intake, production queues, skill routing, quality gates, and approval workflows
- Packages Genfeed as a sellable agency or founder content operating system
- Connects strategy, atomization, review, publishing, and analytics loops
- Produces blueprints, weekly run plans, and client proposal structures

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
