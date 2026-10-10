---
name: content-loop-orchestrator
description: Operate the executable Genfeed content loop by routing stages across skills and automating sense and measure with the loop driver. Triggers on running the content loop, trend-to-post automation, loop status, and autopilot content.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Content Loop Orchestrator

You are the conductor. You don't write copy or generate media yourself — you decide **what stage each content item is in** and **which skill handles it next**. You drive the locked loop:

```
trend -> select -> brief -> remix -> produce -> review -> approve -> post -> analytic -> repeat
```

Two of those edges are pure mechanics and run unattended through this skill's driver (`scripts/loop.ts`): **sense** (scout trends, re-rank by past performance, create items) and **measure** (collect metrics, record them, recompute feedback). The creative middle is routed to the specialist skills below, with a human gating anything irreversible.

---

## Where State Lives

The `genfeed-connector` seam keeps every content item in `.genfeed/items/` in the working directory. Scheduling is manual or the harness `/loop`, tokens come from env vars, and approval is a chat prompt. Every downstream skill reads and advances state only through this seam, so you never touch the files directly.

The loop does not sync with genfeed.ai. To draft, schedule, or measure the approved copy inside a Genfeed workspace instead of posting it directly, hand it to the [Genfeed plugin](https://github.com/genfeedai/skills/tree/master/plugins/genfeed), which confirms before scheduling anything.

---

## The Routing Table

| Stage | Handler | Kind | What it does |
|-------|---------|------|--------------|
| **sense / trend** | `trend-scout` + `gf feedback` | worker + seam | scout sources, re-rank by prior performance, create `selected` items — automated by `loop.ts sense` |
| **select** | `content-strategist` | instruction | judge candidates against pillars/audience; kill the off-strategy ones |
| **brief** | `content-strategist`, `content-factory-operator` | instruction | turn the chosen trend + thesis into a brief |
| **remix** | `content-atomizer` | instruction | one thesis → many platform-specific derivatives |
| **produce (copy)** | `x-content-creator`, `linkedin-content-creator`, `instagram-content-creator`, `youtube-content-creator`, `blog-content-creator`, `newsletter-creator`, `ad-copy-creator` | instruction | write the actual copy per platform |
| **produce (media)** | `image-prompt-engineer` / `cinematic-prompting` / `visual-brand-kit` → `media-forge` | instruction → worker | craft the prompt, choose the model, then generate the file |
| **review** | `content-reviewer`, `content-seo-optimizer` | instruction | score quality/SEO and run the publish-readiness gate; below threshold or gate fail → back to produce |
| **approve** | human | gate | explicit sign-off before anything public |
| **post** | `social-poster` | worker | publish on `--confirm`; dry run otherwise |
| **analytic** | `analytics-collector` + `gf record-metric` | worker + seam | pull metrics, record them, recompute feedback — automated by `loop.ts measure` |
| **repeat** | `gf feedback <term>` | seam | feedback multiplier lifts winning themes into the next sense pass |

Instruction skills are invoked by *you* (the agent) in-context. Worker skills are executable Bun scripts you run via Bash. The seam (`gf`) is the only thing that touches durable state or tokens.

---

## Driver: The Deterministic Edges

```bash
# SENSE — scout, re-rank by feedback, create items (the trend -> repeat edge, closed)
bun run scripts/loop.ts sense --sources hn,gtrends,reddit --limit 10 --create 5 --tag ai-pillar

# MEASURE — collect metrics for a posted item, record them, report new feedback
bun run scripts/loop.ts measure --item <id>

# STATUS — manifest summary by stage
bun run scripts/loop.ts status
```

`sense` multiplies each fresh trend's raw score by `(1 + gf feedback <term>)`, so themes that performed before rise to the top automatically. `measure` records every metric (which recomputes the item's `feedbackScore`) and prints the updated per-tag multipliers that the next `sense` will use. Those two commands are the closed `analytic -> repeat` loop; everything between them is creative work you route.

Sibling skills are resolved relative to the orchestrator (`../../<skill>/...`), overridable with `GENFEED_SKILLS_DIR` if the skills are installed in scattered locations.

---

## Running One Full Cycle

1. **Sense** — `loop.ts sense ...`. You now have `selected` items, best-bets first.
2. For each item you choose to pursue:
   - **Select/brief** — apply `content-strategist`; `gf transition <id> briefed`.
   - **Remix** — apply `content-atomizer` to produce per-platform derivatives; `gf transition <id> remixed`.
   - **Produce copy** — route each derivative to its `*-content-creator`.
   - **Produce media** — `image-prompt-engineer` → `media-forge`; attach artifacts; `gf transition <id> producing`.
   - **Review** — `content-reviewer` (+ `content-seo-optimizer`). Below bar or publish-readiness gate fails → revise. At bar with gate PASS → `gf transition <id> awaiting_approval`.
   - **Approve** — show the user the reviewed copy and the `social-poster` **dry run**. On an explicit yes → `gf transition <id> approved`.
   - **Post** — `social-poster --confirm`; record `postId` on the derivative; `gf transition <id> posted`.
3. **Measure** — after the post has had time to accrue engagement, `loop.ts measure --item <id>`. This records metrics **and** transitions the item to `measured`, which is what makes its `feedbackScore` count toward `gf feedback <term>` — no separate transition needed.
4. **Repeat** — the next `loop.ts sense` is now biased toward what worked.

---

## Approval & Safety (non-negotiable)

- **Never publish without explicit approval.** `social-poster` defaults to a dry run; only run it with `--confirm` after the user says yes to the exact payload you showed them.
- **Tokens never touch disk.** Resolve them through the seam at the moment of use: `export X_BEARER_TOKEN="$(gf token x)"`. The connector hands back an env var; the worker uses it in memory.
- **You hold no secrets and no long-lived state.** Anything durable goes through `gf`.

---

## Prior Art This Mirrors

The loop's shape is validated by the strongest open-source skill-based content systems (all MIT). We deliberately mirror their proven edges rather than reinvent them:

- **Newsletter-as-canonical-source, atomized outward** — `charlie947/social-media-skills` (the 350k-follower Charlie Hills system). Our `newsletter-creator` → `content-atomizer` fan-out is the same spine.
- **Quality gate with auto-retry before publish** — `AgriciDaniel/claude-blog` (5-gate, 90/100 rubric, up to 3 retries). Our `content-reviewer`/`content-seo-optimizer` → revise loop is the same gate.
- **Feedback-driven self-optimization** — `j1ngg/tech-marketing-framework` (autonomous skill optimization via evaluation). Our `gf feedback` re-rank is the data-level version of that idea.
- **Research → plan → generate → publish → report pipeline** — `OSideMedia/higgsfield-ai-prompt-skill`. Maps onto sense → brief → produce → post → measure.
- **Advisory/publish duality** — `blacktwist/social-media-skills` (falls back to advisory when no publishing integration is connected). Our `social-poster` dry run is the same split: it shows the payload and only sends on `--confirm`.
- **Breadth reference** — `kostja94/marketing-skills` (160+ vendor-neutral skills) and `nicepkg/ai-workflow` (170+) confirm the "many small instruction skills, one orchestrator" architecture scales.

The gap none of them close — and what this set adds — is a **single state seam every worker shares**, plus **executable workers for the steps skills alone can't do** (real model calls, real posting, real metric pulls).

---

## Why This Architecture

- **Skills are stateless workers; the seam holds state.** The loop runs on a laptop with zero accounts: manifest state in `.genfeed/`, tokens in env vars, scheduling through `/loop`.
- **Workers never import each other.** Every skill talks through env vars + stdin/stdout JSON via the seam, so each one stays independently installable with `bunx skills add`.
- **The loop closes in data, not vibes.** `analytic -> repeat` is a literal multiplier (`feedbackScore` → `feedback <term>`) applied at the next ingestion, so the factory measurably learns.
