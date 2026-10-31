# Motion Video

Write a Remotion composition with your own Claude or Codex subscription, render it locally to MP4 or PNG, check the frames, and package it the way Genfeed Motion does. No model API and no credits.

## Installation

```bash
bunx skills add genfeedai/skills --skill motion-video
```

Requires [Bun](https://bun.sh) 1.1+, `ffmpeg` and `ffprobe`. Remotion 4.0.530 installs into the project on `init`.

## Usage

```bash
bun run scripts/motion.ts init ./my-motion
bun run scripts/motion.ts render ./my-motion --id Main
bun run scripts/motion.ts frames ./my-motion/out/Main.mp4 --count 6
```

`render` checks the result against the Genfeed Motion limits (even sides, 256 to 1920, at most 1920 x 1080 pixels, 24 or 30 fps, 900 frames, 30 seconds) and exits non-zero if one is broken.

Check the [Remotion licence terms](https://www.remotion.dev/docs/license/pricing) before commercial use. See `SKILL.md` for the workflow.

## License

MIT (this skill). Remotion is licensed separately.
