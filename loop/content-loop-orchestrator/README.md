# Content Loop Orchestrator

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Operate the executable Genfeed content loop and route each stage

## Installation

```bash
bunx skills add genfeedai/skills --skill content-loop-orchestrator
```
<!-- generated:end -->

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

- Routes sense, select, brief, remix, produce, review, approve, post, analytic, and repeat stages
- Automates trend sensing and metric measurement with `scripts/loop.ts`
- Keeps irreversible publishing behind explicit approval

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `scripts/` - executable helpers or workers used by the skill

## License

MIT
