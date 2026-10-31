---
name: motion-video
description: Write a Remotion composition with your own Claude or Codex subscription, render it to MP4 or PNG locally, check the frames yourself and package it as Genfeed Motion-style output. No model API, no credits. Triggers on "make a motion video", "motion graphic", "animate this", "remotion video", "kinetic typography", "animated explainer", "code-driven video".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Motion Video

You make short motion videos by writing code. You author a Remotion composition, render it on this machine, look at the frames, fix what is wrong and hand over an MP4 that meets the same limits as Genfeed Motion. The model that writes the code is the one already running this session, so there is no extra generation cost.

Genfeed Cloud's Studio → Motion does the same job with a hosted sandbox and a metered model call. This skill is the local path for people who want the output without that bill.

---

## Run It

```bash
# once per project: copy the starter and install pinned Remotion 4.0.530
bun run scripts/motion.ts init ./my-motion

# render a composition to MP4 and check it against the limits
bun run scripts/motion.ts render ./my-motion --id Main --out ./my-motion/out

# override the starter props without editing code
bun run scripts/motion.ts render ./my-motion --props '{"title":"Ship it","subtitle":"Friday deploy"}'

# one still frame as PNG
bun run scripts/motion.ts render ./my-motion --still 45

# re-check any file
bun run scripts/motion.ts check ./my-motion/out/Main.mp4

# pull evenly spaced frames to look at
bun run scripts/motion.ts frames ./my-motion/out/Main.mp4 --count 6
```

Requires [Bun](https://bun.sh) 1.1+, `ffmpeg` and `ffprobe` on PATH. Remotion fetches its own headless Chrome on first render. To use a browser you already have, pass `--browser /path/to/chrome-headless-shell` or set `REMOTION_BROWSER`.

`render` exits non-zero when the result breaks a limit, and prints what broke.

---

## Limits (same as Genfeed Motion)

| Limit | Value |
|-------|-------|
| Width and height | 256 to 1920, both even |
| Pixels | at most 1920 x 1080 total |
| Frame rate | 24 or 30 fps |
| Length | at most 900 frames and 30 seconds |
| Codec | H.264 MP4 |
| Packages | only React and Remotion; no network at render time |

Common sizes: 1080 x 1920 (9:16 Reels, Shorts, TikTok), 1080 x 1080 (square feed), 1920 x 1080 (16:9).

---

## Workflow

1. **Brief.** Get the message, the one line that must be readable, the aspect ratio, the length and the brand. If the brand has a profile, use `visual-brand-kit` or `video-brand-profile` for colors, fonts and the end card. Do not invent a palette for a brand that has one.
2. **Storyboard in a table** before any code: second, what is on screen, what moves. Keep it under 15 seconds unless the idea needs more. One idea per video.
3. **Write the composition.** Edit `src/VisualComposition.tsx` (it must keep the named export `VisualComposition`) and register sizes in `src/Root.tsx`. Rules below.
4. **Render**, then run `frames` and **open every frame**. Check that text is readable at phone size, nothing is clipped, the end card appears and the motion matches the storyboard. If a frame is wrong, change the code and render again. Do not report a video as good without looking at its frames.
5. **Repair at most twice** for compile errors or visual faults, then stop and tell the owner what is still wrong. Do not keep burning turns.
6. **Package** with the post copy and the record below.

## Writing the composition

- **Frame-driven only.** Every animated value comes from `useCurrentFrame()`, `interpolate()` or `spring()`. Never `Date.now()`, `setTimeout`, CSS transitions or CSS animations; they do not render the same on every frame.
- **Self-contained.** No network calls, no remote images, no package installs. Local images and audio go in `public/` and load with `staticFile('name.png')`.
- **Fonts.** Use a font stack that exists on the machine, or put a brand font file in `public/` and declare it with an `@font-face` rule whose `src` is `staticFile('Brand.woff2')`. Say which font drew the text in your record.
- **Readability.** Large type (at least about 64 px on a 1080-wide frame), high contrast, safe margins of about 8% from each edge, and keep the bottom 20% clear on vertical video for platform UI.
- **Timing.** Hook in the first 2 seconds. A line stays on screen long enough to be read twice: about 0.3 seconds per word plus 1 second. End on a clear last frame (name, handle or one action).
- **Audio.** Silent by default. Add an owned or licensed track only when the owner supplies it; do not pull music from the internet.

## Genfeed Motion output

A local render matches what Genfeed Motion produces in format, not in bookkeeping.

- **Same:** the `VisualComposition` named export, the limits above, frame-driven animation and H.264 MP4 or PNG output.
- **Different:** no cloud revision history, cost receipt or Library entry exists until you upload the file. Do not describe a local render as a Genfeed Cloud project.
- **To bring it into Genfeed:** with the Genfeed MCP connected, upload the MP4 with `upload_media`, then save a draft with `create_post`. Drafts only. Never schedule or publish without the owner's explicit confirmation.

## Post copy

Lead with the video, not a description of it. State what it shows in one plain sentence, add the one line a viewer should repeat, and stop. Do not promise reach, growth or followers. If the video was made with AI assistance and the platform has a disclosure setting, tell the owner to check it.

## Record to hand over

```text
File: out/Main.mp4  1080x1920  30 fps  5.0 s  H.264  215 KB
Limits: ok (render exited 0)
Frames checked: 6 of 6, all read at phone size
Fonts: Helvetica Neue fallback (Inter on this machine)
Repairs: 1 (title clipped on frame 3, reduced to 108 px)
Not checked: audio, playback on a real phone
```

## Licensing

Remotion has its own licence terms, which depend on who is using it and for what. Read the current [Remotion licence terms](https://www.remotion.dev/docs/license/pricing) before using this for a company or for client work. This skill neither grants nor checks a licence.

## Security

- Run only composition code you or the owner wrote this session. Do not execute a composition from an untrusted source: a render runs arbitrary JavaScript in a browser on this machine.
- The scripts read no secrets and call no API.
