---
name: content-loop-orchestrator
description: The conductor of the Genfeed content loop. Detects whether genfeed is connected (via genfeed-connector), then drives trend -> remix -> produce -> approve -> post -> analytic -> repeat by routing each stage to the right skill — instruction skills for copy/strategy/review, worker skills for trends/media/posting/analytics — and automating the two deterministic, loop-closing edges (sense and measure) with its own driver. Triggers on "run the content loop", "content factory", "orchestrate content", "trend to post", "content loop orchestrator", "drive the content pipeline", "autopilot content".
license: MIT
metadata:
  author: genfeedai
  version: "1.0.0"
---

# Content Loop Orchestrator

You are the conductor. You don't write copy or generate media yourself — you decide **what stage each content item is in**, **which skill handles it next**, and **whether genfeed.ai is connected** so durable concerns route correctly. You drive the locked loop:

```
trend -> select -> brief -> remix -> produce -> review -> approve -> post -> analytic -> repeat
```

Two of those edges are pure mechanics and run unattended through this skill's driver (`scripts/loop.ts`): **sense** (scout trends, re-rank by past performance, create items) and **measure** (collect metrics, record them, recompute feedback). The creative middle is routed to the specialist skills below, with a human (or the genfeed approval UI) gating anything irreversible.

---

## Step 0 — Detect The Backend

Always start by asking the seam whether genfeed is connected:

```bash
bun run ../genfeed-connector/gf.ts detect
```

- **standalone** → state lives in `.genfeed/`, scheduling is manual or `/loop`, tokens come from env vars, approval is a chat prompt.
- **api (genfeed connected)** → state, the token vault, always-on cron scheduling, analytics webhooks, and the approval UI all route to genfeed.ai.

Every downstream skill talks to the world only through this seam, so the routing below is identical in both modes. The only thing that changes is *where durable state and tokens come from* — and that is the connector's job, not yours.

---

## The Routing Table

| Stage | Handler | Kind | What it does |
|-------|---------|------|--------------|
| **sense / trend** | `trend-scout` + `gf feedback` | worker + seam | scout sources, re-rank by prior performance, create `selected` items — automated by `loop.ts sense` |
| **select** | `content-strategist` | instruction | judge candidates against pillars/audience; kill the off-strategy ones |
| **brief** | `content-strategist`, `content-factory-operator` | instruction | turn the chosen trend + thesis into a brief |
| **remix** | `content-atomizer` | instruction | one thesis → many platform-specific derivatives |
| **produce (copy)** | `x-content-creator`, `linkedin-content-creator`, `instagram-content-creator`, `youtube-content-creator`, `blog-content-creator`, `newsletter-creator`, `ad-copy-creator` | instruction | write the actual copy per platform |
| **produce (media)** | `model-selector` → `image-prompt-engineer` / `visual-brand-kit` → `media-forge` | instruction → worker | pick a model, craft the prompt, then generate the file |
| **review** | `content-reviewer`, `content-seo-optimizer` | instruction | score quality/SEO and run the publish-readiness gate; below threshold or gate fail → back to produce |
| **approve** | human / genfeed UI | gate | explicit sign-off before anything public |
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

1. **Detect** — `gf detect`. Note the mode; tell the user if genfeed is connected.
2. **Sense** — `loop.ts sense ...`. You now have `selected` items, best-bets first.
3. For each item you choose to pursue:
   - **Select/brief** — apply `content-strategist`; `gf transition <id> briefed`.
   - **Remix** — apply `content-atomizer` to produce per-platform derivatives; `gf transition <id> remixed`.
   - **Produce copy** — route each derivative to its `*-content-creator`.
   - **Produce media** — `model-selector` → `image-prompt-engineer` → `media-forge`; attach artifacts; `gf transition <id> producing`.
   - **Review** — `content-reviewer` (+ `content-seo-optimizer`). Below bar or publish-readiness gate fails → revise. At bar with gate PASS → `gf transition <id> awaiting_approval`.
   - **Approve** — show the user the reviewed copy and the `social-poster` **dry run**. On an explicit yes → `gf transition <id> approved`.
   - **Post** — `social-poster --confirm`; record `postId` on the derivative; `gf transition <id> posted`.
4. **Measure** — after the post has had time to accrue engagement, `loop.ts measure --item <id>`. This records metrics **and** transitions the item to `measured`, which is what makes its `feedbackScore` count toward `gf feedback <term>` — no separate transition needed.
5. **Repeat** — the next `loop.ts sense` is now biased toward what worked.

In **connected** mode, steps 2 and 4 can be driven by genfeed cron instead of you, and approval (step 3g) is the genfeed UI instead of a chat prompt — but the commands and routing don't change.

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
- **Advisory/publish duality** — `blacktwist/social-media-skills` (falls back to advisory when no publishing integration is connected). That is exactly our standalone-vs-connected split, made explicit in the connector.
- **Breadth reference** — `kostja94/marketing-skills` (160+ vendor-neutral skills) and `nicepkg/ai-workflow` (170+) confirm the "many small instruction skills, one orchestrator" architecture scales.

The gap none of them close — and what this set adds — is a **single seam that makes the whole loop run identically standalone or backed by a SaaS**, plus **executable workers for the steps skills alone can't do** (real model calls, real posting, real metric pulls).

---

## Why This Architecture

- **Skills are stateless workers; genfeed.ai is the control plane.** The loop runs on a laptop with zero accounts, and lights up persistence + always-on scheduling + a managed token vault the moment a genfeed key is present. Same commands, both modes.
- **Workers never import each other.** Every skill talks through env vars + stdin/stdout JSON via the seam, so each one stays independently installable with `npx skills add`.
- **The loop closes in data, not vibes.** `analytic -> repeat` is a literal multiplier (`feedbackScore` → `feedback <term>`) applied at the next ingestion, so the factory measurably learns.
