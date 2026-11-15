# Carousel Renderer

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Render a carousel spec into branded PNG slides and a PDF locally with headless Chrome, no image API

## Installation

```bash
bunx skills add genfeedai/skills --skill carousel-renderer
```
<!-- generated:end -->

## Usage

```bash
bun run scripts/render.ts --spec carousel.json --out out/carousel
```

Formats: `instagram` (1080 x 1350), `linkedin` (1080 x 1350 PDF), `square` (1080 x 1080). Slide types: `cover`, `content`, `stat`, `quote`, `cta`. See `SKILL.md` for the spec.

Pairs with `instagram-carousel` and `linkedin-carousel` for the copy, and `content-reviewer` for the gate.

## License

MIT
