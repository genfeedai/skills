# Search Domain Validator

Validate domain syntax and generate brandable domain options from naming criteria.

## Installation

```bash
bunx skills add genfeedai/skills/search-domain-validator
```

## Usage

```text
"Check whether these domain names are valid"
"Generate brandable domain options for this product name"
"Find domain alternatives for this shortlist"
"Validate domain naming rules for this form"
```

## Boundary

- Use for domain syntax, domain search, availability-oriented checks, and brandable domain alternatives.
- Use `brand-architect` first when the business name or strategic naming direction is not defined.
- Use `competitive-intelligence-analyst` if the concern is market confusion with competitor names.

## What It Does

- Validates domain format against RFC-style rules
- Generates domain suggestions from keywords, suffixes, and naming constraints
- Explains TLD tradeoffs and availability-checking approaches
- Supports implementation guidance for domain validation logic when needed

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
