# Internal Comms

Draft structured internal communications for teams, leaders, incidents, FAQs, newsletters, and project updates.

## Installation

```bash
bunx skills add genfeedai/skills/internal-comms
```

## Usage

```text
"Draft a 3P update from these notes"
"Write a leadership update for this project"
"Turn this incident timeline into an internal report"
"Create FAQ answers for this policy change"
```

## Boundary

- Use for internal audiences and structured operational communication.
- Use `copywriter` for external marketing copy, landing pages, CTAs, product copy, and customer-facing microcopy.
- Use `content-strategist` for public editorial calendars and publishing strategy.

## What It Does

- Routes the request to 3P updates, company newsletters, FAQ answers, or general internal comms
- Uses bundled examples for tone, structure, and content gathering
- Keeps updates clear, decision-oriented, and useful
- Adapts detail level to leadership, team, incident, or broad company context

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `examples/` - format examples and reusable communication patterns

## License

MIT
