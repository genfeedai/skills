# Clip Cutter

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Cut vertical 9:16 clips from a long recording locally with ffmpeg: reframe, burned-in captions, loudness and measured output, no API

## Installation

```bash
bunx skills add genfeedai/skills --skill clip-cutter
```
<!-- generated:end -->

## Usage

```bash
bun run scripts/cut.ts --source talk.mp4 --clips clips.json --out out/clips
```

The manifest reports measured resolution, codecs, duration, loudness and true peak for each clip. See `SKILL.md` for the spec.

## License

MIT
