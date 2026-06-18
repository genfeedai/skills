# Email Finder

Find contact emails associated with a domain, starting with free discovery methods and using APIs when available.

## Installation

```bash
bunx skills add genfeedai/skills/email-finder
```

## Usage

```text
"Find contact emails for example.com"
"Discover the email pattern for this company domain"
"Scan this domain for public team emails"
"Verify whether these guessed emails look valid"
```

## Boundary

- Use for domain-level email discovery and verification.
- Use `leads-researcher` for broader account research, decision-maker discovery, company enrichment, and buyer intent signals.
- Use `outbound-optimizer` after contacts are found to write the outreach system.

## What It Does

- Searches public pages, WHOIS data, and common email patterns
- Uses Hunter, Apollo, Snov, or Clearbit when API keys exist
- Deduplicates, verifies, and classifies confidence where possible
- Keeps compliance, rate limiting, robots.txt, and opt-out considerations visible

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed

## License

MIT
