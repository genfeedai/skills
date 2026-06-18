# Leads Researcher

Research prospect accounts, decision makers, contact details, and buyer intent signals.

## Installation

```bash
bunx skills add genfeedai/skills/leads-researcher
```

## Usage

```text
"Research these target accounts for outbound"
"Find decision makers at this company list"
"Identify buyer intent signals for these prospects"
"Enrich this lead list with company data and contacts"
```

## Boundary

- Use for broad account and prospect research.
- Use `email-finder` for domain-level email discovery and email pattern verification.
- Use `startup-icp-definer` before this when the target account profile is still unclear.

## What It Does

- Gathers company size, industry, revenue, location, tech stack, news, and funding context
- Finds likely decision makers and relevant contact information
- Identifies intent signals from job postings, tech usage, news, and online behavior
- Keeps privacy, compliance, verification, and source confidence visible

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed

## License

MIT
