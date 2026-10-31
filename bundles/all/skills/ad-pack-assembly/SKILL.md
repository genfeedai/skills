---
name: ad-pack-assembly
description: Assemble existing video shots, stills, on-screen text, voiceover and music into a finished ad on your own machine with ffmpeg, then cut a 9:16 or 1:1 version from the same sources. No model call, no credits. Triggers on "assemble the ad", "ad pack", "stitch these shots", "add text and voiceover to these clips", "cut a 9:16 version", "put the ad together", "multi-scene ad".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Ad Pack Assembly

You turn a set of finished shots into one finished ad. The shots already exist: generated clips, screen captures, stills, a voiceover recording, a music bed. You trim them, put them in order, burn in the on-screen text, mix the sound, render, and check the result. Everything runs locally with `ffmpeg`. No model runs and no Genfeed credits are spent.

Genfeed Cloud's `generate_ad_pack` and ad remix workflow do the generation and the assembly in one hosted flow. This skill is the local assembly half for people who already have the shots, or who generated them elsewhere.

Its rule, taken from the Genfeed ad packs: **never ask a video model to render legible words.** Text, logos and end cards are added here, in post, so they are exact.

---

## Run It

```bash
# 1. check the manifest, probe every file, print the timeline and any warnings (renders nothing)
bun run scripts/assemble.ts plan pack.json

# 2. render the master and every cutdown listed in the manifest
bun run scripts/assemble.ts build pack.json --out ./out

# 3. pull evenly spaced frames and look at every one
bun run scripts/assemble.ts frames ./out/pack.mp4 --count 8
```

Requires [Bun](https://bun.sh) 1.1+ and `ffmpeg` and `ffprobe` (5.0 or newer, tested on 6.1) on PATH, with the `drawtext` filter (libfreetype) if the pack has on-screen text. Zero npm dependencies. Tests: `bun test ./ad-pack-assembly`.

`build` exits non-zero when an output fails its checks, and writes `<name>.build.json` next to the video with the timeline, the checks and what was not checked. Add `--only 9x16` to build one output, `--keep-work` to keep the intermediate files.

---

## The pack manifest

One JSON file. Paths are relative to the manifest. A starter is in `templates/ad-pack.example.json`.

| Field | Meaning |
|-------|---------|
| `name` | Output name: letters, digits, `.`, `-`, `_` |
| `size` | Master size, for example `1920x1080`. Both sides must be even |
| `fps` | `24`, `25`, `30` (default), `50` or `60` |
| `shots[]` | The shots, in order |
| `voiceover` | `{ file, start, gainDb }`: starts `start` seconds into the video |
| `music` | `{ file, gainDb, duck, fadeOut }`: looped to length, ducked under the voiceover by default, faded out |
| `font` | Font file for the text (or set `ADPACK_FONT`). Falls back to a common system font |
| `style` | `{ fontSize, color, boxColor }`: size is a fraction of the shorter side (default `0.06`) |
| `cutdowns[]` | `{ name, size, fit, focus }`: more versions built from the same source shots |
| `loudness` | Integrated loudness target in LUFS, default `-14` |

A shot:

| Field | Meaning |
|-------|---------|
| `id`, `file` | Unique id, and a video (`mp4`, `mov`, `webm`) or still image (`png`, `jpg`, `webp`) |
| `trim` | `{ start, duration }` in seconds. Without `duration`, the rest of the clip |
| `duration` | Required for a still image |
| `fit` | `cover` (fill and crop, default) or `contain` (letterbox on black, for screen captures) |
| `focus` | Where `cover` crops horizontally, `0` left to `1` right (default `0.5`) |
| `audio` | `mute` (default) or `keep` the clip's own sound |
| `audioFrom` | `{ file, start }`: take this shot's sound from a time range of another file, so b-roll can play over one continuous voice |
| `text[]` | `{ text, start, end, position }`: `position` is `top`, `center` or `bottom` (default). Times are seconds into the shot |
| `transition` | `{ type, duration }` into the next shot: `fade`, `fadeblack`, `fadewhite`, `dissolve`, `wipeleft`, `wiperight`, `slideleft`, `slideright`, `smoothleft`, `smoothright`, `circleopen`. Omit for a hard cut |

Transitions overlap the neighbouring shots, so the video gets shorter by the overlap. `plan` prints the real timeline.

---

## Workflow

1. **Collect the shots and the brief.** Use the written storyboard: shot order, the on-screen line for each, the voiceover, the format. If the shots are not made yet, write their prompts first with `ugc-ad-prompts` or `cinematic-prompting`, and the ad copy with `ad-copy-creator`. This skill does not generate footage.
2. **Write the manifest.** One shot per storyboard row. Put every on-screen line in `text[]`, not in the prompt. Use `fit: contain` for screen captures so no UI is cropped.
3. **Animated cards.** For a title card, an animated lower third or an end card that needs motion, render it with `motion-video` at the same size and frame rate, then list the MP4 as a shot. A static end card can be a still with `duration` and `text`.
4. **Plan.** Run `plan`. Read every warning: cropped shots, text that outlives its shot, a voiceover longer than the video, a font that is missing.
5. **Build.** Run `build`. It renders the master and each cutdown from the original shots, never from the master, so a 9:16 is not a crop of a crop.
6. **Look at it.** Run `frames` on each output and open every frame. Check that text is readable at phone size, nothing is clipped, the last frame is the call to action, and in a vertical cut the bottom fifth is clear. Do not report the ad as good without looking.
7. **Repair at most twice.** Fix the manifest (timing, `focus`, text length), rebuild, and look again. If it is still wrong, tell the owner exactly what.
8. **Hand over** with the record below. Post copy and publishing are separate steps: `social-poster` posts only after the owner approves a dry run.

## Cutdowns

A 16:9 master with a `9x16` cutdown is the common pack. `fit: cover` fills the frame and crops, so set `focus` to keep the subject in view (`0.3` keeps more of the left). Text is re-laid out for the new size: bottom text moves up to keep the bottom fifth of vertical video clear for platform UI. Use `fit: contain` on a cutdown to letterbox instead of cropping.

## Sound

- The voiceover is placed at `start` seconds. If it is longer than the video, `plan` warns and the end is cut.
- Music is looped, faded out over `fadeOut` seconds and, when there is a voiceover, ducked under it. Supply owned or licensed audio only. Do not pull music from the internet.
- The mix is normalised to `loudness` with a single `loudnorm` pass. That lands close to the target, not exactly on it.
- Shots are muted unless `audio: keep` or `audioFrom` is set. Muted shots contribute silence, so a pack with no voiceover and no music still has an audio track.

## Record to hand over

```text
File: out/handoff-tax.mp4  1920x1080  30 fps  28.0 s  H.264  AAC
Cutdown: out/handoff-tax-9x16.mp4  1080x1920  30 fps  28.0 s
Checks: ok (size, frame rate, duration, codec, audio present)
Frames checked: 8 of 8 per output, text readable at phone size
Fonts: Inter Bold on this machine
Repairs: 1 (shot 3 text shortened, wrapped to three lines)
Not checked: playback on a real phone, platform upload limits, that the shots match the brief
```

---

## Genfeed integration

- **Source shots** can come from Genfeed (`get_assets` to find them, `generate` to make them) or from any other tool.
- **Bring the result into Genfeed** with the Genfeed MCP connected: `upload_media` for the MP4, then `create_post` to save a draft. Drafts only. Never schedule or publish without the owner's explicit confirmation.
- A local build is not a Genfeed Cloud ad pack: it has no Library asset ids, cost receipt or rejected-output record until you upload it. Do not describe it as one.

## Security

- `ffmpeg` and `ffprobe` are called with argument lists, never through a shell. On-screen text is written to files, so quotes, colons and percent signs in the copy cannot break the filter graph. Colour values are checked before they reach a filter.
- The scripts read no secrets, make no network call, and write only to the `--out` directory.
- Open media files only from sources the owner trusts. `ffmpeg` decodes whatever it is given.

## Known limits

- Tested against synthetic clips and stills on Linux with ffmpeg 6.1, not against real generated footage, and not on macOS or Windows.
- Text wrapping is a character-count estimate, so very long lines in a narrow cutdown can overflow. Shorten the line or lower `style.fontSize`.
- The text style is one box style. Animated, branded or kinetic text belongs in `motion-video`.
- One loudness pass, no true-peak verification. Check loudness by ear on a phone.
- No automatic captions from speech. Burn captions from a script by listing them in `text[]`.
