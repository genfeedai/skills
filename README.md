# Genfeed Skills

AI-powered skills for Genfeed content creation, optimization, analysis, communications, image and visual systems, advertising, GTM strategy, platform development, and onboarding. Works standalone with any Claude Code setup and works even better with [Genfeed.ai](https://genfeed.ai).

## Installation

Install all skills:

```bash
bunx skills add genfeedai/skills
```

Or install individual skills:

```bash
bunx skills add genfeedai/skills/x-content-creator
bunx skills add genfeedai/skills/content-seo-optimizer
# ... any skill name below
```

## Public vs Skills Pro

This MIT repository is the free Genfeed skills catalogue. It stays focused on broad,
installable skills that are useful without a paid Genfeed account:

- Platform-native creation for X, Instagram, LinkedIn, YouTube, newsletters, and blogs.
- Content optimization, SEO, atomization, review, analytics collection, and humanization.
- Image, visual, advertising, GTM, and platform-development skills that are reusable across
  normal content workflows.
- Standalone Genfeed integration helpers that make open skills work better when a Genfeed
  workspace is available.

Skills Pro is the paid operating layer sold through Genfeed. Keep the following out of this
public MIT repo:

- Account warmup systems for X, Instagram, LinkedIn, TikTok, and YouTube.
- Source-to-brief systems, brand memory, model routing, production queues, approval packets,
  performance loops, eval rubrics, client reports, and subscription deliverables.
- Private packaging, licensed bundle registries, receipt verification, download URLs, and
  paid customer setup copy.

The current decision is that warmup skills belong in `genfeedai/skills-pro`, not in this
public repo.

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

## Content Creation

| Skill | Description |
|-------|-------------|
| [x-content-creator](./x-content-creator/) | X/Twitter posts, threads, quote tweets, and reply strategies |
| [instagram-content-creator](./instagram-content-creator/) | Instagram captions, carousel outlines, Reels scripts, Stories, and hashtag strategy |
| [linkedin-content-creator](./linkedin-content-creator/) | LinkedIn posts, articles, carousels, and newsletter editions |
| [youtube-content-creator](./youtube-content-creator/) | YouTube titles, descriptions, tags, chapters, thumbnail briefs, Shorts, and retention planning |
| [newsletter-creator](./newsletter-creator/) | Newsletter editions with subject lines, editorial structures, and growth tactics |
| [blog-content-creator](./blog-content-creator/) | SEO-optimized blog posts, guides, and long-form articles |
| [copywriter](./copywriter/) | Non-ad conversion copy for landing pages, CTAs, value propositions, pricing pages, onboarding, and microcopy |

## Content Optimization

| Skill | Description |
|-------|-------------|
| [content-strategist](./content-strategist/) | Editorial strategy, content pillars, platform roles, cadence, calendars, and KPIs |
| [content-factory-operator](./content-factory-operator/) | Repeatable Genfeed content operations with intake, briefs, production queues, review gates, and analytics loops |
| [content-atomizer](./content-atomizer/) | Repurpose one source asset into platform-native derivatives |
| [content-reviewer](./content-reviewer/) | Quality review with six-dimension scoring and publish-readiness gates |
| [content-seo-optimizer](./content-seo-optimizer/) | SEO scoring and search optimization for content drafts |
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
| [visual-brand-kit](./visual-brand-kit/) | Visual brand systems for AI-generated content: colors, typography feel, photography style, composition, and prompt presets |
| [model-selector](./model-selector/) | Choose the right AI model for image, video, and audio generation tasks |
| [media-forge](./media-forge/) | Generate image, video, and audio artifacts through Replicate or fal.ai workers |

## Advertising

| Skill | Description |
|-------|-------------|
| [ad-copy-creator](./ad-copy-creator/) | Paid ad copy for Meta, Google, LinkedIn, TikTok, and X with direct-response variants and test plans |
| [ad-performance-analyzer](./ad-performance-analyzer/) | Paid media performance diagnosis, KPI analysis, creative fatigue checks, and optimization recommendations |

## GTM Strategy

| Skill | Description |
|-------|-------------|
| [brand-architect](./brand-architect/) | Brand foundations: name, positioning, voice, and strategic identity |
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
| [workflow-creator](./workflow-creator/) | Create Genfeed Studio workflows from natural language descriptions |
| [node-creator](./node-creator/) | Create custom Genfeed nodes with the SDK builder API |
| [content-loop-orchestrator](./content-loop-orchestrator/) | Operate the executable Genfeed content loop and route each stage to the right skill |
| [genfeed-connector](./genfeed-connector/) | Detect Genfeed connectivity and provide the content-loop state, token, manifest, and feedback seam |
| [social-poster](./social-poster/) | Publish approved derivatives to X or LinkedIn with a dry-run-by-default approval gate |
| [onboarding](./onboarding/) | Genfeed onboarding focused on first content creation in under 10 minutes |
| [scope-validator](./scope-validator/) | Classify Genfeed feature requests as OSS Core or Cloud SaaS scope |
| [openclaw-integration](./openclaw-integration/) | Connect agents and workflows to Genfeed.ai through MCP or CLI |

## Genfeed Integration

Every skill works standalone. When used inside a Genfeed workspace, skills can detect platform tools for enhanced results:

- `create_post` - draft content directly into the platform
- `generate_image` - generate images with the recommended model
- `rate_content` - score content quality
- `generate_ad_pack` - assemble full ad creatives
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
| `genfeedai/skills-pro` | Private paid skills catalogue | Source of truth for warmup, Pro operations, packaging, registry, receipts, and customer setup |

When a skill appears in `genfeed.ai/skills/` but not here, classify it before copying:

- Copy it here only when it is a broad free skill that can be MIT-licensed.
- Move or mirror it to `genfeedai/skills-pro` when it is paid operating knowledge, account
  warmup, private process, client deliverable, or subscription value.
- Do not copy Pro-only content into this repo. If a public dependency is needed, document the
  dependency by name instead of duplicating the Pro skill body.

As of this boundary decision, the app-local warmup skills (`x-warmup`, `instagram-warmup`,
`linkedin-warmup`, `tiktok-warmup`, and `youtube-warmup`) are Skills Pro material.

## Contributing

1. Fork the repository
2. Create or update a skill in `your-skill-name/`
3. Include `SKILL.md`, `metadata.json`, and `README.md`
4. Run the validation commands from this repository
5. Submit a pull request

## License

MIT
