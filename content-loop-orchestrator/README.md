# Content Loop Orchestrator

The **conductor** of the Genfeed content loop. Detects whether genfeed is connected, then drives `trend -> remix -> produce -> approve -> post -> analytic -> repeat` by routing each stage to the right skill and automating the two deterministic, loop-closing edges (**sense** and **measure**) with its own driver.

It writes no copy and generates no media itself — it decides what stage each item is in, which skill handles it next, and where durable state and tokens come from.

## Installation

```bash
bunx skills add genfeedai/skills/content-loop-orchestrator
```

Requires [Bun](https://bun.sh) 1.1+ and the sibling skills it routes to (at minimum `genfeed-connector`, `trend-scout`, `analytics-collector`; plus `media-forge`, `social-poster`, and the instruction creator skills for the full loop). Zero runtime dependencies.

## Driver

```bash
# SENSE — scout, re-rank by feedback, create items
bun run scripts/loop.ts sense --sources hn,gtrends,reddit --limit 10 --create 5 --tag ai-pillar

# MEASURE — collect metrics for a posted item, record them, report new feedback
bun run scripts/loop.ts measure --item <id>

# STATUS — manifest summary by stage
bun run scripts/loop.ts status
```

`sense` multiplies each fresh trend's score by `(1 + gf feedback <term>)` so past winners rise first. `measure` records metrics (recomputing `feedbackScore`) and prints the multipliers the next `sense` will use. Together they are the closed `analytic -> repeat` loop.

Sibling skills resolve relative to this one (`../../<skill>/...`); override with `GENFEED_SKILLS_DIR`.

## Routing

| Stage | Handler |
|-------|---------|
| sense | `trend-scout` + `gf feedback` (automated) |
| select / brief | `content-strategist`, `content-factory-operator` |
| remix | `content-atomizer` |
| produce copy | `x-content-creator`, `linkedin-content-creator`, `instagram-content-creator`, `youtube-content-creator`, `blog-content-creator`, `newsletter-creator`, `ad-copy-creator` |
| produce media | `model-selector` → `image-prompt-engineer` / `visual-brand-kit` → `media-forge` |
| review | `content-reviewer`, `content-seo-optimizer` |
| approve | human / genfeed UI |
| post | `social-poster` (`--confirm` gate) |
| analytic | `analytics-collector` + `gf record-metric` (automated) |
| repeat | `gf feedback <term>` |

## Modes

- **standalone** — `.genfeed/` state, manual/`/loop` scheduling, env-var tokens, chat approval.
- **api (genfeed connected)** — state DB, cron scheduling, token vault, analytics webhooks, approval UI — all via `genfeed-connector`. Same commands, same routing.

## Safety

- Never publishes without explicit approval (`social-poster` is dry-run by default).
- Holds no secrets and no long-lived state; everything durable goes through the seam.

## License

MIT
