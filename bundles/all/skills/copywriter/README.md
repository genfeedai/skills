# Copywriter

Write and audit non-ad conversion copy that adapts to the project brand voice.

## Installation

```bash
bunx skills add genfeedai/skills/copywriter
```

## Usage

```text
"Write landing page copy for this new offer"
"Audit this pricing page copy for clarity and conversion"
"Rewrite these CTAs to match our brand voice"
"Improve the microcopy in this onboarding flow"
```

## Boundary

- Use for website, landing page, product, onboarding, CTA, value proposition, and microcopy work.
- Use `ad-copy-creator` for paid ad units, ad creative variants, platform-specific ad constraints, and ad test plans.
- Use `brand-architect` first when the brand voice or positioning is not yet defined.

## What It Does

- Discovers brand voice from project docs and existing copy
- Writes headlines, CTAs, value propositions, pricing copy, and product microcopy
- Audits for consistency, clarity, conversion, and technical correctness
- Cuts vague marketing language and replaces it with concrete outcomes

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
