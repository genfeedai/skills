# Clip Cutter

Cut vertical 9:16 clips from a long recording on your own machine with ffmpeg: reframe, burn in captions from your transcript, normalise loudness, add an end card and verify the encode. No API and no credits. Makes `youtube-shorts` and `tiktok-video` executable.

## Installation

```bash
bunx skills add genfeedai/skills --skill clip-cutter
```

Requires [Bun](https://bun.sh) 1.1+ and `ffmpeg` with libass.

## Usage

```bash
bun run scripts/cut.ts --source talk.mp4 --clips clips.json --out out/clips
```

The manifest reports measured resolution, codecs, duration, loudness and true peak for each clip. See `SKILL.md` for the spec.

## License

MIT
