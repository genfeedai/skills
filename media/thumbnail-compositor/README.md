# Thumbnail Compositor

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Composite three branded thumbnail variants locally with exact text and signature placement using headless Chrome, no image API

## Installation

```bash
bunx skills add genfeedai/skills --skill thumbnail-compositor
```
<!-- generated:end -->

## Usage

```bash
bun run scripts/compose.ts --spec thumbs.json --out out/thumbs
```

Modes: `livestream`, `recap` (1280 x 720) and `short` (1080 x 1920). Exactly three variants, at most four words of text. Each variant also gets a 168 px related-video preview. See `SKILL.md` for the spec.

## License

MIT
