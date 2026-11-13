# Quote Finder

Find fresh public X (Twitter) posts a brand can quote, ranked, with the link, why it fits and a suggested angle.

## Installation

```bash
bunx skills add genfeedai/skills --skill quote-finder
```

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
