# Carousel Renderer

Turn an approved carousel outline into branded PNG slides and a PDF on your own machine. Uses a local Chrome or Chromium, so there is no image API and no credits.

## Installation

```bash
bunx skills add genfeedai/skills --skill carousel-renderer
```

Requires [Bun](https://bun.sh) 1.1+ and Chrome or Chromium. Set `CHROME_PATH` if the binary is in an unusual place.

## Usage

```bash
bun run scripts/render.ts --spec carousel.json --out out/carousel
```

Formats: `instagram` (1080 x 1350), `linkedin` (1080 x 1350 PDF), `square` (1080 x 1080). Slide types: `cover`, `content`, `stat`, `quote`, `cta`. See `SKILL.md` for the spec.

Pairs with `instagram-carousel` and `linkedin-carousel` for the copy, and `content-reviewer` for the gate.

## License

MIT
