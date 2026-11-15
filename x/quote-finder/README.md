# Quote Finder

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Find fresh public X (Twitter) posts worth quote-posting for a brand, ranked with a fit reason and a suggested angle. Proposes only.

## Installation

```bash
bunx skills add genfeedai/skills --skill quote-finder
```
<!-- generated:end -->

## Usage

```
"Find posts worth quoting today for our brand from these accounts: ..."
"Here are 6 links to recent posts. Which should we quote?"
```

## What It Does

- Ranks recent public posts by freshness, brand fit, room to add and author reach
- Returns the link, why it fits, an angle and a draft opening line for each
- Says plainly when it cannot read fresh posts, instead of inventing them
- Proposes only; nothing is posted or scheduled. The final wording goes through `x-post`

## License

MIT
