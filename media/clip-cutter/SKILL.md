---
name: clip-cutter
description: Cut vertical 9:16 clips from a long recording locally with ffmpeg. Reframe, burn in captions from your transcript, normalise loudness, add an end card and verify the encode. No API. Triggers on "cut the clips", "make the shorts", "burn in captions", "reformat for tiktok", "cut this recording into vertical clips", "render the shorts".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Clip Cutter

You turn the clip choices from `youtube-shorts` or `tiktok-video` into finished files. Those skills decide which moment, which first sentence and which layout. You do the cutting, reframing, captioning and encoding with ffmpeg on this machine. No model is called and no key is needed.

This is a **worker skill**: one script, JSON in, files and a measured manifest out.

---

## Run It

```bash
# check ranges and lengths without encoding
bun run scripts/cut.ts --source talk.mp4 --clips clips.json --out out/clips --dry-run

# cut every clip in clips.json
bun run scripts/cut.ts --source talk.mp4 --clips clips.json --out out/clips
```

Requires [Bun](https://bun.sh) 1.1+, and `ffmpeg` and `ffprobe` on PATH, with the `ass` filter (libass). Zero npm packages.

---

## The Spec

```json
{
  "profile": {
    "version": "2026-10-1",
    "layout": "fit",
    "fps": 30,
    "loudnessLufs": -16,
    "truePeakDb": -1.5,
    "fadeMs": 15,
    "fontsDir": "./fonts",
    "captions": { "fontName": "Inter", "fontSize": 78, "marginV": 520, "maxWordsPerGroup": 3, "uppercase": true, "primaryColor": "#FFFFFF", "outlineColor": "#000000" },
    "endCard": { "text": "@genfeedai", "seconds": 1.5, "background": "#0b0b10", "foreground": "#7c5cff" }
  },
  "clips": [
    {
      "id": "cost-of-local",
      "start": "00:12:03.4",
      "end": "00:12:48",
      "words": [ { "w": "Local", "s": 723.6, "e": 724.0 }, { "w": "rendering", "s": 724.0, "e": 724.6 } ]
    },
    { "id": "second-clip", "start": 3000, "end": 3042, "srt": "./talk.srt", "focusX": 0.4 }
  ]
}
```

| Field | Notes |
|-------|-------|
| `start`, `end` | Seconds or `HH:MM:SS(.ms)` in the source. A clip must be 1 to 180 seconds and inside the source. |
| `words` | Word timings in source seconds. Grouped `maxWordsPerGroup` at a time. |
| `srt` | Alternative: an SRT file with source-relative times. Cues are shown as written. |
| `layout` | `fit` keeps the whole frame over a blurred copy of itself. `fill` crops to 9:16; `focusX` (0 to 1) picks the crop position. |
| `endCard` | Optional. Add it only if the video brand profile asks for one. |
| `fontsDir` | Folder with the brand font files. A missing `fontName` falls back silently, so check the frames. |

Captions are required: every clip needs `words` or `srt`.

The timed transcript is an input. Use whichever transcription you already have; this skill does not make one. Check names, numbers and product terms against the recording before you cut.

---

## Workflow

1. **Choose the moments** with `youtube-shorts` or `tiktok-video`, and read the channel's [video brand profile](../video-brand-profile/SKILL.md). Copy its caption font, position, loudness and end card into `profile`.
2. **Write `clips.json`.** Start each clip on the sentence that carries the claim. Do not cut so a speaker says something stronger than they said.
3. **Dry run**, then cut.
4. **Read the manifest.** It reports measured values, not the settings you asked for: resolution, codecs, duration, integrated loudness and true peak. Loudness is a one-pass normalisation, so expect it near the target, not exact.
5. **Look at the clips.** Pull frames at the start, middle and end, and check that captions are readable, inside the interface zones and match the speech. Report technical checks separately from a watch-through.
6. **Package** with `youtube-title`, `youtube-description`, `tiktok-title`, `tiktok-description` and `thumbnail-compositor` for the cover.
7. **Upload only with the owner's go.**

## Encode settings

1080 x 1920, H.264 (CRF 20, yuv420p), AAC 160 kbps at 48 kHz, `+faststart`, at the profile's fps. Loudness uses ffmpeg `loudnorm` with the profile's target, with a short audio and video fade at the start and an audio fade at the end. The interface zones of Shorts and TikTok have no official pixel values, so `marginV` is a working value you verify on a phone.

## Rules

- Do not invent quotes, timestamps or numbers. Mark an estimated timestamp as estimated and check it.
- Keep real audio; do not add music you do not own.
- Disclosure toggles (paid partnership, realistic AI-generated content) are set on upload. Tell the owner to check the platform's current rules.
- A rendered file proves the render, not that anyone watched it.

## Limits

- Single speaker-agnostic crop: no face tracking. Use `fit`, or set `focusX` by eye.
- Captions are plain grouped text, no per-word highlight.
- One source video per run.

## Genfeed Integration

Works standalone. With a Genfeed workspace, upload a finished clip with `upload_media`. Drafts only; never publish or schedule without the owner's explicit confirmation.
