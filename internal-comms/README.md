# Internal Comms

Draft internal communications including status reports, leadership updates, newsletters, FAQs, incident reports, and project updates.

## Installation

```bash
bunx skills add genfeedai/skills/internal-comms
```

## Usage

```
"Draft a 3P update from these notes"
"Write a leadership update for this project"
"Turn this incident timeline into an internal report"
"Create FAQ answers for this policy change"
```

## What It Does

- Routes each request to the correct communication format
- Uses included examples for 3P updates, company newsletters, FAQs, and general comms
- Structures updates for clarity, audience, and decision-making
- Keeps internal writing direct and useful instead of polished-but-empty
- Preserves Anthropic upstream provenance and Apache-2.0 licensing

## License

Apache-2.0

## Upstream

Derived from **[anthropics/skills](https://github.com/anthropics/skills)** (Apache-2.0).

| Field | Value |
|-------|-------|
| Source | [`skills/internal-comms/SKILL.md`](https://github.com/anthropics/skills/blob/main/skills/internal-comms/SKILL.md) |
| Upstream ref | `main` |
| Synced at commit | `ef740771ac90` |
| Last synced | 2026-06-12 |
| License | Apache-2.0 |

**Local modifications:** Vendored from Anthropic's official skills repo as a standalone marketplace plugin. No behavioral changes beyond provenance metadata.

**Checking for upstream changes:** when upstream has moved ahead of the synced marker above, diff [`skills/internal-comms/SKILL.md`](https://github.com/anthropics/skills/blob/main/skills/internal-comms/SKILL.md) on `main` since commit `ef740771ac90`, port anything worth bringing home, then bump `metadata.upstream_commit` (or `metadata.upstream_version`) and `metadata.last_synced` in `SKILL.md` and this table.
