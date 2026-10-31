# Genfeed Skills

AI-powered skills for Genfeed content creation, optimization, analysis, communications, image and visual systems, advertising, GTM strategy, and Genfeed integration. Works standalone with any Claude Code setup and works even better with [Genfeed.ai](https://genfeed.ai).

## Installation

Install all skills:

```bash
bunx skills add genfeedai/skills
```

Or install individual skills:

```bash
bunx skills add genfeedai/skills --skill x-content-creator
bunx skills add genfeedai/skills --skill content-seo-optimizer
# ... any skill name below
```

## Writing a source-backed SEO article

Use a focused workflow rather than installing every writing skill:

1. `blog-content-creator` drafts for one reader task and search intent.
2. `content-reviewer` checks usefulness and verifies claims before publication.
3. `content-seo-optimizer` checks search presentation, links and technical SEO.
4. Use `content-atomizer` afterward if you want to repurpose the approved article.

Install just the three editorial skills:

```bash
bunx skills add genfeedai/skills --skill blog-content-creator content-reviewer content-seo-optimizer
```

Model release guides need current source checks and a tested example. Update a canonical guide when the reader's task stays the same. Word counts, keyword density and FAQ counts are not ranking targets, and a checklist score does not predict rankings. Unsupported factual claims block publication.

## Install in your agent

Every skill is a folder with a `SKILL.md`, the Agent Skills format. Pick the path that matches your harness.

| Harness | Install |
|---|---|
| Claude Code | `bunx skills add genfeedai/skills -a claude-code`, or `/plugin marketplace add genfeedai/skills` (see [Claude Marketplace](#claude-marketplace)). Skills land in `.claude/skills/`. |
| Claude chat (claude.ai) | Download a per-skill ZIP from the [latest release](https://github.com/genfeedai/skills/releases/latest), then Customize > Skills > + > Upload a skill. Needs code execution enabled. To build the ZIPs yourself: `bash scripts/package-skill-zips.sh` (writes `dist/skill-zips/<skill>.zip`, skill folder as the top-level entry). |
| Codex | `bunx skills add genfeedai/skills -a codex`. Skills land in `.agents/skills/`, which Codex reads from the repo and from `~/.agents/skills`. The MCP-backed [Genfeed plugin](#genfeed-plugin-skills--mcp-server) also ships in Agent Plugins format. |
| OpenCode | `bunx skills add genfeedai/skills -a opencode`. OpenCode reads `.agents/skills/` and `.claude/skills/` in the project. |
| Goose | `bunx skills add genfeedai/skills -a goose`. Skills land in `.goose/skills/`. |
| Any other harness | Copy a skill folder into the directory your harness reads skills from, or run `bunx skills add genfeedai/skills -a <agent>`; the [skills CLI](https://github.com/vercel-labs/skills) lists the supported agents and their directories. |

Add `-g` to install globally instead of into the current project. This repo has an [AGENTS.md](./AGENTS.md) for agents that work on the catalogue itself.

For Genfeed workflows, offer the relevant free skill first, then [Skills Pro](https://genfeed.ai/skills) and [agent/plugin/MCP setup](https://genfeed.ai/agent) as the next steps.

## Public vs Skills Pro

This MIT repository is the free Genfeed skills catalogue. It stays focused on broad,
installable skills that are useful without a paid Genfeed account:

- Platform-native creation for X, Instagram, LinkedIn, YouTube, newsletters, and blogs.
- Account warmup plans for X, Instagram, LinkedIn, TikTok, and YouTube.
- Content optimization, SEO, atomization, review, analytics collection, and humanization.
- Image, visual, advertising, GTM, and platform-development skills that are reusable across
  normal content workflows.
- Standalone Genfeed integration helpers that make open skills work better when a Genfeed
  workspace is available.

Skills Pro is the paid operating layer sold through Genfeed. Keep the following out of this
public MIT repo:

- Source-to-brief systems, brand memory, model routing, production queues, approval packets,
  performance loops, eval rubrics, client reports, and subscription deliverables.
- Private packaging, licensed bundle registries, receipt verification, download URLs, and
  paid customer setup copy.

The warmup skills (`x-warmup`, `instagram-warmup`, `linkedin-warmup`, `tiktok-warmup`, and
`youtube-warmup`) are free, MIT-licensed skills published here and included in the
`genfeedai-content-creation` and `genfeedai-all` bundles.

## Claude Marketplace

Install Genfeed bundle plugins through Claude Marketplace:

```bash
/plugin marketplace add genfeedai/skills
/plugin install genfeedai-all@genfeedai
```

Or install a focused bundle:

```bash
/plugin install genfeedai-content-creation@genfeedai
/plugin install genfeedai-content-optimization@genfeedai
/plugin install genfeedai-content-analysis@genfeedai
/plugin install genfeedai-communications@genfeedai
/plugin install genfeedai-image-visual@genfeedai
/plugin install genfeedai-advertising@genfeedai
/plugin install genfeedai-gtm-strategy@genfeedai
/plugin install genfeedai-platform-development@genfeedai
/plugin install genfeedai-content-loop@genfeedai
```

## Genfeed Plugin (skills + MCP server)

`plugins/genfeed/` packages twelve MCP-aware content skills together with the remote Genfeed MCP
server (`https://mcp.genfeed.ai/mcp`), so an assistant can plan, draft, generate and schedule content
from your Genfeed brand. Nothing is scheduled or published without explicit confirmation. The folder
serves two formats from one `skills/` tree: Agent Plugins 1.0 (`plugin.json`, `mcp.json`) for ChatGPT,
Codex, Copilot and Cursor, and a Claude plugin (`.claude-plugin/plugin.json`, `.mcp.json`).

```bash
/plugin marketplace add genfeedai/skills
/plugin install genfeed@genfeedai
```

See [plugins/genfeed/README.md](./plugins/genfeed/README.md) for the skill list, and
[plugins/genfeed/LISTING.md](./plugins/genfeed/LISTING.md) for directory submission copy.

## Content Creation

| Skill | Description |
|-------|-------------|
| [x-content-creator](./x-content-creator/) | Router: sends X requests to x-post, x-thread or x-article (keeps old installs working) |
| [x-post](./x-post/) | One X post, quote post or reply: hooks, algorithm signals, checklist |
| [x-thread](./x-thread/) | X threads of 2 to 15 posts: hook, value chain, closing CTA, bump plan |
| [x-article](./x-article/) | Long-form X Article plus its promo post |
| [instagram-content-creator](./instagram-content-creator/) | Router: sends Instagram requests to the post, carousel, Reel or Story skill (keeps old installs working) |
| [instagram-post](./instagram-post/) | Instagram feed caption, hashtags, alt text and image brief |
| [instagram-carousel](./instagram-carousel/) | Instagram carousel slide copy, design spec and caption |
| [instagram-reel](./instagram-reel/) | Reel hook, timed script, caption and production handoff |
| [instagram-story](./instagram-story/) | Story sequences with stickers and a weekly theme calendar |
| [linkedin-content-creator](./linkedin-content-creator/) | Router: sends LinkedIn requests to linkedin-post, linkedin-article or linkedin-carousel (keeps old installs working) |
| [linkedin-post](./linkedin-post/) | LinkedIn text posts: six formats, hooks, tone, comment strategy |
| [linkedin-article](./linkedin-article/) | LinkedIn articles and newsletter editions with a promo post |
| [linkedin-carousel](./linkedin-carousel/) | LinkedIn PDF carousels: slide copy, design spec, caption |
| [youtube-content-creator](./youtube-content-creator/) | YouTube titles, descriptions, tags, chapters, thumbnail briefs, Shorts, and retention planning |
| [video-brand-profile](./video-brand-profile/) | One reusable video brand profile: logo or signature placement, caption font and position, thumbnail rules and export sizes |
| [youtube-shorts](./youtube-shorts/) | Pick, cut, caption and package branded YouTube Shorts from long recordings and livestreams |
| [youtube-thumbnail](./youtube-thumbnail/) | Branded thumbnails for livestreams, recaps and Shorts covers with three test concepts and signature placement |
| [youtube-title](./youtube-title/) | Truthful YouTube titles for livestreams, recaps, cutdowns and Shorts, paired with the thumbnail |
| [youtube-description](./youtube-description/) | YouTube descriptions with accurate chapters, sources and the channel footer |
| [tiktok-video](./tiktok-video/) | Reformat a recording or Short into a branded 9:16 TikTok video with burned-in captions |
| [tiktok-title](./tiktok-title/) | TikTok hook, cover text and the searchable first caption line |
| [tiktok-description](./tiktok-description/) | TikTok captions with specific hashtags and disclosures within the 2,200 character limit |
| [newsletter-creator](./newsletter-creator/) | Newsletter editions with subject lines, editorial structures, and growth tactics |
| [blog-content-creator](./blog-content-creator/) | SEO-optimized blog posts, guides, and long-form articles |
| [copywriter](./copywriter/) | Non-ad conversion copy for landing pages, CTAs, value propositions, pricing pages, onboarding, and microcopy |
| [launch-copy-creator](./launch-copy-creator/) | Show HN titles, Product Hunt taglines, and maker first comments that respect each community's norms |
| [x-warmup](./x-warmup/) | Evidence-backed X account warmup with engagement plans, reply strategy, and warmup threads |
| [instagram-warmup](./instagram-warmup/) | Instagram account warmup with engagement plans, Stories strategy, and first Reel and carousel briefs |
| [linkedin-warmup](./linkedin-warmup/) | LinkedIn account warmup with comment-first engagement, SSI-building, and a first story post |
| [tiktok-warmup](./tiktok-warmup/) | Transparent 5-7 day TikTok warm-up with native engagement and gradual first uploads |
| [youtube-warmup](./youtube-warmup/) | YouTube channel warmup with engagement plans, warmup Shorts, SEO setup, and post-warmup assessment |

## Content Optimization

| Skill | Description |
|-------|-------------|
| [content-strategist](./content-strategist/) | Editorial strategy, content pillars, platform roles, cadence, calendars, and KPIs |
| [content-factory-operator](./content-factory-operator/) | Repeatable Genfeed content operations with intake, briefs, production queues, review gates, and analytics loops |
| [content-atomizer](./content-atomizer/) | Repurpose one source asset into platform-native derivatives |
| [content-reviewer](./content-reviewer/) | Quality review with six-dimension scoring and publish-readiness gates |
| [content-seo-optimizer](./content-seo-optimizer/) | SEO scoring and search optimization for content drafts |
| [content-geo-optimizer](./content-geo-optimizer/) | GEO scoring, citation-ready rewrites, source attribution, and schema recommendations for answer engines |
| [humanizer](./humanizer/) | Rewrite AI-generated drafts to sound natural while preserving meaning and voice |

## Content Analysis

| Skill | Description |
|-------|-------------|
| [trend-scout](./trend-scout/) | Pull and score trend signals for the Genfeed content loop |
| [analytics-collector](./analytics-collector/) | Collect post-performance metrics and feed them back into content-loop learning |
| [competitor-analyzer](./competitor-analyzer/) | Audit competitors' content strategy, channels, formats, topics, and engagement gaps |
| [youtube-video-analyst](./youtube-video-analyst/) | Deconstruct YouTube videos into hooks, retention mechanics, emotional beats, and reusable blueprints |

## Communications

| Skill | Description |
|-------|-------------|
| [internal-comms](./internal-comms/) | Draft structured internal status reports, 3P updates, leadership updates, newsletters, FAQs, and incident reports |

## Image and Visual

| Skill | Description |
|-------|-------------|
| [image-prompt-engineer](./image-prompt-engineer/) | Optimized prompts for AI image and short video generation across major visual models |
| [cinematic-prompting](./cinematic-prompting/) | Rewrite image and video prompts with precise camera, framing, lighting, and editing vocabulary |
| [prompt-generator](./prompt-generator/) | Structured JSON image and video prompts with style settings and a recommended model |
| [visual-brand-kit](./visual-brand-kit/) | Visual brand systems for AI-generated content: colors, typography feel, photography style, composition, and prompt presets |
| [media-forge](./media-forge/) | Generate image, video, and audio artifacts through Replicate or fal.ai workers |
| [brand-os-architect](./brand-os-architect/) | Source-backed Brand OS systems for AI-era brands, launch storytelling, visual rules, and generation checklists |
| [motion-video](./motion-video/) | Write a Remotion composition with your own Claude or Codex sub, render it locally and package it as Genfeed Motion-style output, no model API |
| [carousel-renderer](./carousel-renderer/) | Render an approved carousel spec into branded PNG slides and a PDF locally with headless Chrome, no image API |
| [thumbnail-compositor](./thumbnail-compositor/) | Composite three branded thumbnail variants locally with exact text and signature placement, no image API |
| [clip-cutter](./clip-cutter/) | Cut vertical 9:16 clips from a long recording locally with ffmpeg: captions, loudness and measured output, no API |

## Advertising

| Skill | Description |
|-------|-------------|
| [ad-copy-creator](./ad-copy-creator/) | Paid ad copy for Meta, Google, LinkedIn, TikTok, and X with direct-response variants and test plans |
| [ad-performance-analyzer](./ad-performance-analyzer/) | Paid media performance diagnosis, KPI analysis, creative fatigue checks, and optimization recommendations |
| [ugc-ad-prompts](./ugc-ad-prompts/) | Free prompt pack for UGC-style video ads: selfie, talking head and screen demo templates, camera modes and a pre-flight checklist |

## GTM Strategy

| Skill | Description |
|-------|-------------|
| [brand-architect](./brand-architect/) | Brand foundations: name, positioning, voice, and strategic identity |
| [brand-os-architect](./brand-os-architect/) | Brand operating systems: positioning, voice, content, visual rules, evidence, and AI context |
| [positioning-angles](./positioning-angles/) | Differentiated market angles, mechanisms, narratives, and positioning tests |
| [startup-icp-definer](./startup-icp-definer/) | ICP, buyer personas, user personas, buying centers, pains, triggers, and targeting focus |
| [pricing-strategist](./pricing-strategist/) | Premium and value-based pricing strategy, tiers, price-rise plans, and pricing confidence |
| [offer-architect](./offer-architect/) | High-converting offers, bundles, guarantees, packages, and value stacks |
| [offer-validator](./offer-validator/) | Existing offer scoring and fixes against the Value Equation |
| [funnel-architect](./funnel-architect/) | Sales funnels, value ladders, customer journeys, and landing page sequences from scratch |
| [funnel-validator](./funnel-validator/) | Existing funnel audits for Hook-Story-Offer, value ladder fit, traffic match, and conversion path |
| [traffic-architect](./traffic-architect/) | Audience acquisition and traffic strategy from scratch using Dream 100, organic vs paid paths, and owned audience plans |
| [traffic-validator](./traffic-validator/) | Existing traffic strategy scoring across Dream 100 clarity, hook strategy, paid/organic fit, funnel alignment, and conversion path |
| [channel-validator](./channel-validator/) | Channel focus and expansion-readiness validation against the One Channel Rule |
| [lead-channel-optimizer](./lead-channel-optimizer/) | Lead generation channel prioritization by ROI, cost, close rate, effort, and system potential |
| [outbound-optimizer](./outbound-optimizer/) | Cold email, DM, prospecting, personalization, and outbound sequence optimization |
| [leads-researcher](./leads-researcher/) | Prospect accounts, decision makers, contact details, company data, and buyer intent signals |
| [email-finder](./email-finder/) | Contact emails, domain-level email discovery, email patterns, and verification guidance |
| [competitive-intelligence-analyst](./competitive-intelligence-analyst/) | GTM competitors, market positioning, feature gaps, pricing, win/loss patterns, and differentiation opportunities |
| [partnership-builder](./partnership-builder/) | Affiliate, integration, reseller, co-marketing, embedded distribution, and partner outreach strategy |
| [retention-engine](./retention-engine/) | Retention, activation, ascension, upsell, cross-sell, subscription, churn reduction, and LTV systems |
| [support-systems-architect](./support-systems-architect/) | Scalable support systems, help docs, FAQs, ticketing, self-service, automation, and response templates |
| [constraint-eliminator](./constraint-eliminator/) | Customer friction, buying objections, implementation blockers, refund causes, and success obstacles |
| [expert-architect](./expert-architect/) | Personal expert positioning, attractive character, origin story, Big Domino, authority, and new opportunity framing |
| [expert-validator](./expert-validator/) | Existing expert positioning and authority narrative scoring |
| [search-domain-validator](./search-domain-validator/) | Domain syntax validation, availability-oriented checks, and brandable domain options |

## Platform and Development

| Skill | Description |
|-------|-------------|
| [content-loop-orchestrator](./content-loop-orchestrator/) | Operate the executable Genfeed content loop and route each stage to the right skill |
| [genfeed-connector](./genfeed-connector/) | Local content-loop state, manifest, feedback, and env-based token seam |
| [social-poster](./social-poster/) | Publish approved derivatives to X or LinkedIn with a dry-run-by-default approval gate |
| [genfeed-brand-os](./genfeed-brand-os/) | Genfeed.ai Brand OS for product copy, launch content, prompts, and website CTAs |

## Genfeed Integration

Every skill works standalone. When used inside a Genfeed workspace, skills can detect platform tools for enhanced results:

- `create_post` - draft content directly into the platform
- `generate` - generate images, video, voice, or music (`type: image|video|voice|music`) with the recommended model
- Assess content quality with the skill rubric and available performance evidence
- `find_tools` - discover available tools before assembling ad creative
- Brand context and top-performing content patterns are used for voice consistency

## Skill Structure

Each skill folder includes:

```text
{skill-name}/
├── SKILL.md        # Main skill instructions with YAML frontmatter
├── metadata.json   # Triggers, tags, outputs, and references
└── README.md       # Reader-facing documentation
```

Some skills also include `references/`, `scripts/`, or `examples/` when they need supporting material or executable workers. Skill folders must not include `plugin.json`.

Marketplace bundles are generated under `bundles/` from `scripts/plugin-categories.json`:

```bash
bun run marketplace:generate
```

## Inventory Sync Policy

There are three Genfeed skill inventories:

| Inventory | Purpose | Sync rule |
| --- | --- | --- |
| `genfeedai/skills` | Public, MIT-licensed free skills | Source of truth for free skills and Claude Marketplace bundles |
| `genfeed.ai/skills/` | App-local product skills used by the Genfeed monorepo | May mirror public skills, but app-local additions must be classified as public or Pro before publishing |
| `genfeedai/skills-pro` | Private paid skills catalogue | Source of truth for Pro operations, packaging, registry, receipts, and customer setup |

When a skill appears in `genfeed.ai/skills/` but not here, classify it before copying:

- Copy it here only when it is a broad free skill that can be MIT-licensed.
- Move or mirror it to `genfeedai/skills-pro` when it is paid operating knowledge, private
  process, client deliverable, or subscription value.
- Do not copy Pro-only content into this repo. If a public dependency is needed, document the
  dependency by name instead of duplicating the Pro skill body.

## Contributing

1. Fork the repository
2. Create or update a skill in `your-skill-name/`
3. Include `SKILL.md`, `metadata.json`, and `README.md`
4. Run the validation commands from this repository
5. Submit a pull request

## License

MIT
