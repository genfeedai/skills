# Long-Form Storyboard

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Turn a voice note or transcript into a long-form video storyboard with narration and cutaway briefs, then compile it into a local assembly manifest

## Installation

```bash
bunx skills add genfeedai/skills --skill long-form-storyboard
```
<!-- generated:end -->

Plan a long video from a voice note or idea dump. The model in your session writes the storyboard: sections, narration for the ear, and a cutaway brief for each beat. The script then validates it against the Genfeed limits, estimates timing, exports the read-aloud script, shot list and captions, and compiles your recording and cutaway images into a manifest for `ad-pack-assembly`.

The local counterpart of Genfeed Cloud's `generate_media` (its plan and start long-form actions): plan, cutaways, spoken animatic, presenter cut. No model call, no credits, no network.

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
bun test ./youtube/long-form-storyboard
```

## License

MIT
