# Long-Form Storyboard

Plan a long video from a voice note or idea dump. The model in your session writes the storyboard: sections, narration for the ear, and a cutaway brief for each beat. The script then validates it against the Genfeed limits, estimates timing, exports the read-aloud script, shot list and captions, and compiles your recording and cutaway images into a manifest for [ad-pack-assembly](../ad-pack-assembly/).

The local counterpart of Genfeed Cloud's `storyboard_long_form`: plan, cutaways, spoken animatic, presenter cut. No model call, no credits, no network.

## Installation

```bash
bunx skills add genfeedai/skills/long-form-storyboard
bunx skills add genfeedai/skills/ad-pack-assembly   # to assemble the video
```

Requires [Bun](https://bun.sh) 1.1+. `ffprobe` is used only to read the recording's length.

## Usage

```bash
bun run scripts/storyboard.ts validate storyboard.json
bun run scripts/storyboard.ts script storyboard.json --out ./out --audio voice.m4a
bun run scripts/storyboard.ts manifest storyboard.json --audio voice.m4a --out ./out/pack.json
bun run scripts/storyboard.ts manifest storyboard.json --presenter presenter.mp4 --out ./out/pack.json
```

A starter storyboard is in [templates/storyboard.example.json](./templates/storyboard.example.json). The workflow, schema and limits are in [SKILL.md](./SKILL.md).

## Tests

```bash
bun test ./long-form-storyboard
```

## License

MIT
