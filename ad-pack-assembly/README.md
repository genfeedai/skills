# Ad Pack Assembly

Assemble finished shots into one finished ad on your own machine. You give it a manifest: video clips and stills in order, the on-screen text for each, a voiceover, a music bed, and any cutdown sizes. It trims, fits and joins the shots with `ffmpeg`, burns in the text, mixes and normalises the sound, renders, and checks size, frame rate, duration, codec and audio.

No model call, no credits, no network. Text is added in post, so it is always exact.

## Installation

```bash
bunx skills add genfeedai/skills/ad-pack-assembly
```

Requires [Bun](https://bun.sh) 1.1+ and `ffmpeg` / `ffprobe` 5.0+ on PATH (with `drawtext` if the ad has text).

## Usage

```bash
bun run scripts/assemble.ts plan pack.json                  # validate, probe, print the timeline
bun run scripts/assemble.ts build pack.json --out ./out     # render master + cutdowns
bun run scripts/assemble.ts frames ./out/pack.mp4 --count 8 # frames to look at
```

A starter manifest is in [templates/ad-pack.example.json](./templates/ad-pack.example.json). The full field reference, workflow and limits are in [SKILL.md](./SKILL.md).

## What it does and does not do

- Does: trim, fit (cover or contain), still images, on-screen text, crossfades and cuts, voiceover placement, music looping and ducking, loudness normalisation, 9:16 and 1:1 cutdowns from the same sources, output checks.
- Does not: generate footage, voice or music; transcribe speech; render animated or kinetic text (use `motion-video` for cards, then add the MP4 as a shot).

## Tests

```bash
bun test ./ad-pack-assembly
```

Unit tests cover the manifest rules, the timeline and the ffmpeg arguments. Integration tests build real videos from synthetic clips and are skipped when ffmpeg is not installed.

## License

MIT
