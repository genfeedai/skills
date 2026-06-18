# Genfeed Skills

AI-powered skills for content creation, content loop automation, GTM strategy, image generation, SEO optimization, advertising, and workflow building. Works standalone with any Claude Code setup — works even better with [Genfeed.ai](https://genfeed.ai).

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

## Content Creation

| Skill | Description |
|-------|-------------|
| [x-content-creator](./x-content-creator/) | X/Twitter posts, threads, and replies optimized for engagement |
| [instagram-content-creator](./instagram-content-creator/) | Captions, carousels, Reels scripts, and Story sequences |
| [linkedin-content-creator](./linkedin-content-creator/) | Posts, articles, carousels, and newsletter editions |
| [youtube-content-creator](./youtube-content-creator/) | Titles, descriptions, tags, chapters, thumbnails, and Shorts |
| [newsletter-creator](./newsletter-creator/) | Newsletter editions with editorial structure and subject lines |
| [blog-content-creator](./blog-content-creator/) | SEO-optimized blog posts, guides, and long-form articles |
| [copywriter](./copywriter/) | Conversion-focused landing page, CTA, value proposition, and UX copy |

## Content Optimization

| Skill | Description |
|-------|-------------|
| [content-seo-optimizer](./content-seo-optimizer/) | SEO scoring (0-100) and optimization for any content type |
| [content-atomizer](./content-atomizer/) | Repurpose 1 piece of content into 15+ across platforms |
| [content-reviewer](./content-reviewer/) | Quality review with 6-dimension scoring before publishing |
| [humanizer](./humanizer/) | Remove AI writing patterns and make drafts sound more natural |

## Content Analysis

| Skill | Description |
|-------|-------------|
| [youtube-video-analyst](./youtube-video-analyst/) | Deconstruct YouTube videos into hooks, retention mechanics, and reusable blueprints |

## Content Loop Automation

| Skill | Description |
|-------|-------------|
| [content-loop-orchestrator](./content-loop-orchestrator/) | Drive the trend → produce → post → analytic content loop |
| [trend-scout](./trend-scout/) | Pull and rank trend signals from public sources |
| [media-forge](./media-forge/) | Generate image, video, and audio media artifacts |
| [social-poster](./social-poster/) | Publish approved derivatives to X and LinkedIn |
| [analytics-collector](./analytics-collector/) | Collect post metrics and close the feedback loop |
| [genfeed-connector](./genfeed-connector/) | Detect Genfeed connectivity and route manifest, token, and feedback state |

## Communications

| Skill | Description |
|-------|-------------|
| [internal-comms](./internal-comms/) | Draft status reports, leadership updates, newsletters, FAQs, and incident reports |

## Image and Visual

| Skill | Description |
|-------|-------------|
| [image-prompt-engineer](./image-prompt-engineer/) | Optimized image prompts for Flux, DALL-E, Midjourney, Imagen, and more |
| [model-selector](./model-selector/) | Choose the right AI model for image, video, and audio tasks |
| [visual-brand-kit](./visual-brand-kit/) | Create a consistent visual brand identity for AI-generated content |

## Advertising

| Skill | Description |
|-------|-------------|
| [ad-copy-creator](./ad-copy-creator/) | Ad copy using PAS, AIDA, BAB, StoryBrand, and 4Ps frameworks |
| [ad-performance-analyzer](./ad-performance-analyzer/) | Analyze ad performance and recommend optimizations |

## GTM Strategy

| Skill | Description |
|-------|-------------|
| [brand-architect](./brand-architect/) | Brand naming, positioning, voice, and identity foundations |
| [positioning-angles](./positioning-angles/) | Find differentiated positioning angles and market narratives |
| [startup-icp-definer](./startup-icp-definer/) | Define ICP, pains, buying triggers, and targeting focus |
| [pricing-strategist](./pricing-strategist/) | Premium and value-based pricing strategy |
| [offer-architect](./offer-architect/) | Construct high-converting offers, bundles, and value stacks |
| [offer-validator](./offer-validator/) | Score and improve offer readiness |
| [funnel-architect](./funnel-architect/) | Design funnels, value ladders, and customer journeys |
| [funnel-validator](./funnel-validator/) | Validate funnel sequence and conversion weaknesses |
| [traffic-architect](./traffic-architect/) | Build traffic strategy and audience acquisition plan |
| [traffic-validator](./traffic-validator/) | Validate traffic strategy and targeting |
| [channel-validator](./channel-validator/) | Validate marketing channels and focus |
| [lead-channel-optimizer](./lead-channel-optimizer/) | Prioritize highest-ROI lead generation channels |
| [outbound-optimizer](./outbound-optimizer/) | Improve outbound strategy and messaging systems |
| [leads-researcher](./leads-researcher/) | Research prospects, accounts, and buyer signals |
| [email-finder](./email-finder/) | Find contact emails associated with domains |
| [competitive-intelligence-analyst](./competitive-intelligence-analyst/) | Analyze market positioning, competitors, pricing, and gaps |
| [partnership-builder](./partnership-builder/) | Design affiliate, integration, reseller, and co-marketing partnerships |
| [retention-engine](./retention-engine/) | Design retention, ascension, upsell, and LTV systems |
| [support-systems-architect](./support-systems-architect/) | Build support systems and customer success workflows |
| [constraint-eliminator](./constraint-eliminator/) | Remove friction, objections, and customer success blockers |
| [expert-architect](./expert-architect/) | Build expert positioning, authority, and origin story |
| [expert-validator](./expert-validator/) | Validate expert positioning and authority narrative |
| [search-domain-validator](./search-domain-validator/) | Generate and validate brand and domain naming options |

## Strategy

| Skill | Description |
|-------|-------------|
| [content-factory-operator](./content-factory-operator/) | Design and run repeatable AI content factory systems for agencies, founders, and client retainers |
| [content-strategist](./content-strategist/) | Content calendar, pillar strategy, and platform planning |
| [competitor-analyzer](./competitor-analyzer/) | Competitive content analysis and gap identification |

## Platform and Development

| Skill | Description |
|-------|-------------|
| [workflow-creator](./workflow-creator/) | Create Genfeed workflows from natural language |
| [node-creator](./node-creator/) | Custom nodes with the Genfeed SDK builder API |
| [prompt-generator](./prompt-generator/) | AI image/video prompt generation (see also image-prompt-engineer) |
| [onboarding](./onboarding/) | Get started with Genfeed in under 10 minutes |
| [scope-validator](./scope-validator/) | Validate feature scope (core vs cloud) |
| [openclaw-integration](./openclaw-integration/) | Connect AI agents to Genfeed via MCP |

## Genfeed Integration

Every skill works standalone. When used inside a Genfeed workspace, skills automatically detect platform tools for enhanced results:

- `create_post` — draft content directly into the platform
- `generate_image` — generate images with the recommended model
- `rate_content` — score content quality
- `generate_ad_pack` — assemble full ad creatives
- Brand context and top-performing content patterns are used for voice consistency

## Skill Structure

Each skill is a folder with three files:

```
{skill-name}/
├── SKILL.md        # Main skill instructions (YAML frontmatter + markdown)
├── metadata.json   # Triggers, tags, references
└── README.md       # Documentation
```

## Contributing

1. Fork the repository
2. Create your skill in `your-skill-name/`
3. Include SKILL.md, metadata.json, and README.md
4. Submit a pull request

## License

MIT
