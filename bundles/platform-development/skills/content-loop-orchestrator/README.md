# Content Loop Orchestrator

Operate the Genfeed content loop by routing each content stage to the right skill and automating the deterministic sense and measure edges.

## Installation

```bash
bunx skills add genfeedai/skills/content-loop-orchestrator
```

## Usage

```text
"Run the content loop from trends to reviewed drafts"
"Check content loop status"
"Measure a posted item and update feedback"
"Orchestrate trend-to-post production through Genfeed skills"
```

## Boundary

- Use when the content loop is being executed, inspected, or automated.
- Use `content-factory-operator` when the user needs the operating model or client delivery system designed before execution.
- Use `genfeed-connector` directly for low-level state, token, or feedback commands.

## What It Does

- Detects standalone vs connected Genfeed mode
- Routes sense, select, brief, remix, produce, review, approve, post, analytic, and repeat stages
- Automates trend sensing and metric measurement with `scripts/loop.ts`
- Keeps irreversible publishing behind explicit approval

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `scripts/` - executable helpers or workers used by the skill

## License

MIT
