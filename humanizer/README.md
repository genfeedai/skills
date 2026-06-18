# Humanizer

Identify and remove AI writing patterns so text sounds more natural and human.

## Installation

```bash
bunx skills add genfeedai/skills/humanizer
```

## Usage

```
"Humanize this LinkedIn draft without changing the meaning"
"Make this announcement sound less AI-generated"
"Remove AI writing patterns from this article intro"
"Rewrite this paragraph with more voice and rhythm"
```

## What It Does

- Finds common AI writing tells such as sterile structure, over-emphasis, and generic transitions
- Rewrites flagged passages while preserving the original meaning
- Adds voice, rhythm, opinion, and specificity where the draft feels flat
- Matches the intended tone instead of applying one universal style
- Includes upstream provenance because the original repository has no explicit license

## License

Unspecified (no upstream LICENSE)

## Upstream

Derived from **[ankshvayt/humanizer](https://github.com/ankshvayt/humanizer)** (Unspecified (no upstream LICENSE)).

| Field | Value |
|-------|-------|
| Source | [`SKILL.md`](https://github.com/ankshvayt/humanizer/blob/main/SKILL.md) |
| Upstream ref | `main` |
| Synced at commit | `c5d51c926d24` |
| Last synced | 2026-06-12 |
| License | Unspecified (no upstream LICENSE) |

**Local modifications:** Vendored from ankshvayt/humanizer (24 numbered patterns, verbatim overlap). NOTE: upstream repo ships NO LICENSE file — all-rights-reserved by default; redistribution permission unconfirmed. Flag for review.

**Checking for upstream changes:** when upstream has moved ahead of the synced marker above, diff [`SKILL.md`](https://github.com/ankshvayt/humanizer/blob/main/SKILL.md) on `main` since commit `c5d51c926d24`, port anything worth bringing home, then bump `metadata.upstream_commit` (or `metadata.upstream_version`) and `metadata.last_synced` in `SKILL.md` and this table.
