# Genfeed Skills

AI-powered skills for content creation, image generation, SEO optimization, advertising, and workflow building. Works standalone with any Claude Code setup — works even better with [Genfeed.ai](https://genfeed.ai).

## Installation

Install all skills:

```bash
npx skills add genfeedai/skills
```

Or install individual skills:

```bash
npx skills add genfeedai/skills/x-content-creator
npx skills add genfeedai/skills/content-seo-optimizer
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

## Content Optimization

| Skill | Description |
|-------|-------------|
| [content-seo-optimizer](./content-seo-optimizer/) | SEO scoring (0-100) and optimization for any content type |
| [content-atomizer](./content-atomizer/) | Repurpose 1 piece of content into 15+ across platforms |
| [content-reviewer](./content-reviewer/) | Quality review with 6-dimension scoring before publishing |

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

## Strategy

| Skill | Description |
|-------|-------------|
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
