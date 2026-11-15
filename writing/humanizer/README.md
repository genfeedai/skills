# Humanizer

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Rewrite AI-generated drafts to sound natural while preserving meaning and voice

## Installation

```bash
bunx skills add genfeedai/skills --skill humanizer
```
<!-- generated:end -->

## Usage

```text
"Humanize this LinkedIn draft without changing the meaning"
"Make this announcement sound less AI-generated"
"Remove AI writing patterns from this article intro"
"Rewrite this paragraph with more rhythm and voice"
```

## Boundary

- Use after a draft exists and the problem is tone, rhythm, specificity, or AI writing tells.
- Use `copywriter` when the goal is conversion copy, CTAs, landing pages, or value propositions.
- Use platform creator skills when the goal is a new post, article, newsletter, or script from scratch.

## What It Does

- Finds sterile structure, generic transitions, inflated significance, and other LLM writing tells
- Preserves meaning while adding specificity, rhythm, opinion, and voice
- Matches the intended tone instead of applying one universal style
- Returns edited copy plus the most important pattern fixes when useful

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
