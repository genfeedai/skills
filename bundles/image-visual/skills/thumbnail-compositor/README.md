# Thumbnail Compositor

Composite three branded thumbnail variants on your own machine: backdrop, exact text and the signature at the profile's ratio. Uses a local Chrome or Chromium, so there is no image API and no credits. Pairs with `youtube-thumbnail` (the brief) and `video-brand-profile` (the rules).

## Installation

```bash
bunx skills add genfeedai/skills --skill thumbnail-compositor
```

Requires [Bun](https://bun.sh) 1.1+ and Chrome or Chromium.

## Usage

```bash
bun run scripts/compose.ts --spec thumbs.json --out out/thumbs
```

Modes: `livestream`, `recap` (1280 x 720) and `short` (1080 x 1920). Exactly three variants, at most four words of text. Each variant also gets a 168 px related-video preview. See `SKILL.md` for the spec.

## License

MIT
