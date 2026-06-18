# Brand Architect

Create the strategic brand foundation: name, positioning, voice, identity direction, and viability checks.

## Installation

```bash
bunx skills add genfeedai/skills/brand-architect
```

## Usage

```text
"What should I name this AI workflow product?"
"Define the brand positioning and voice for my startup"
"Create a day-one brand strategy for this offer"
"Evaluate these brand name options and recommend the strongest"
```

## Boundary

- Use for strategic brand architecture: naming, positioning, voice, differentiation, and identity foundations.
- Use `visual-brand-kit` after this for colors, typography feel, photography style, composition, and visual prompt presets.
- Use `search-domain-validator` for domain syntax, availability-oriented checks, and domain alternatives after names are shortlisted.

## What It Does

- Generates and scores name candidates across multiple naming strategies
- Builds positioning statements and voice dimensions
- Checks memorability, pronounceability, spellability, uniqueness, and domain fit
- Produces a strategic identity brief that downstream copy and visual skills can use

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed

## License

MIT
