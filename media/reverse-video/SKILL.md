---
name: reverse-video
description: Reverse-engineer a reference video into a frame-exact shot list (cuts, framing, camera moves, lighting, on-screen text, sound) and one prompt per shot, then recreate it with your own subject and check the result against the original. Triggers on "reverse engineer this video", "recreate this reel", "remake this video", "break down this video shot by shot", "shot list from a reference video", "copy the style of this video", "what camera moves are in this clip".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
  short-description: "Reverse-engineer a reference video into a frame-exact shot list and one prompt per shot, recreate it with your own subject and check it against the original."
  tags: video, reverse-engineering, shot-list, storyboard, recreate, ffmpeg, local
  outputs: files, json
  triggers: "reverse engineer this video; recreate this reel; remake this video; break down this video shot by shot; shot list from a reference video; copy the style of this video; what camera moves are in this clip"
---

# Reverse Video

You take a reference clip someone admires and turn it into a recipe: every cut to the exact frame, then for each shot the framing, camera move, lighting, action, on-screen text and sound. From the recipe you write one video prompt per shot, recreate the clip with the owner's own subject, and measure the result against the original.

This is a recreation of structure and look, not a copy. The new clip has a new subject (the owner's character or brand), new footage and new audio. Never reuse the source's footage, voice, music or watermark, never reproduce a real person's face or likeness, and never draw a logo by hand: use the owner's own mark or leave it out. Work only on videos the owner has the right to study.

Use `cinematic-prompting` for the camera and lighting words, `video-realism` for the structure of each shot prompt, and `motion-video` for rebuilt on-screen graphics.

## Ask for these first

1. The reference video file (a local path; a clip of 60 seconds or less works best) and what the owner likes about it.
2. Who or what replaces the subject: a character, persona or product, with its reference images in the Library. A recreation without a subject reference gives a different person in every shot.
3. The output: aspect ratio, total length, and whether it needs sound.
4. A credit limit, if there is one. Say what each paid stage costs before running it.

## Tools

Everything in steps 1 to 4 runs on this machine. Requires [Bun](https://bun.sh) 1.1+, and `ffmpeg` and `ffprobe` on PATH. No model is called and no key is needed until step 7.

```bash
bun run scripts/measure.ts probe ref.mp4
bun run scripts/measure.ts cuts ref.mp4
bun run scripts/measure.ts frames ref.mp4 --range 80,90 [--roi x,y,w,h] --out out/frames
bun run scripts/measure.ts sheet ref.mp4 --every 1 --out out/sheet.png
bun run scripts/measure.ts compare ref.mp4 recreation.mp4
```

## 1. The original sets the canvas

Run `probe`. The recreation uses the same width, height and frame rate, and the same duration in frames divided by fps. A fractional rate stays a fraction (`30000/1001`). If the owner wants another aspect ratio, say so now and treat it as a deliberate change, not a mistake.

## 2. Find every cut

Run `cuts`. It lists each cut with its frame, its time and a score for how far it stands above the frames around it. It finds jump cuts and punch-ins inside one take, which a scene score on the whole picture misses.

- Write a time as frame divided by fps, rounded down. Frame 83 at 30 fps is `2.766666`; `2.767` lands a frame late. The script prints times that way.
- Confirm every cut by looking. A flash of light, a whip pan or a dissolve can score as a cut without being one. The same picture under different light is one shot.
- If a cut you can see is missing, lower `--min-score` and run again.

## 3. Read the frames where something changes

Pull consecutive frames, a few either side of each cut and wherever something enters, leaves or transitions: `frames --range a,b`. Add `--roi x,y,w,h` to crop to one element. A sheet taken every second or quarter-second misses timing that is only 1 to 3 frames long: which way things enter and leave, a blur at a cut, a one-frame flash. Use `sheet --every 1` only for the overview.

## 4. Break down each shot

For every shot, fill these fields from what you see, not from what is usual:

| Field | What to write |
| --- | --- |
| Time | First and last frame, and length in seconds |
| Framing | Shot size: extreme close-up, close-up, medium, wide. Where the subject sits in the frame |
| Camera | Height and angle, lens feel (wide, normal, telephoto), movement with direction and speed: static, handheld, push in, pull back, pan, tilt, orbit, tracking |
| Cuts inside | Timed cuts and punch-ins within the shot |
| Action | What the subject does, in beats, in present tense |
| Setting | Where it is, and what is in the background |
| Light | Direction, hardness, colour temperature, practical lights, contrast |
| Look | Palette, grade, grain, depth of field, any filter |
| Text | Exact words, font traits (weight, width, case), colour, position, the frame it appears and leaves, how it arrives (cut, fade, type-on, word by word) |
| Transition | A hard cut, or a fade, dissolve, wipe or flash with its measured frames |
| Sound | Spoken line, music mood and tempo, sound effects, with times |

Look at every large piece of text through its whole life: the frame it appears, how it changes, the frame it leaves. Name how the letters are made: solid, gradient, outline, glow. Size text from its ink: crop the line in a source frame and in a frame of yours and match the box, not the font size by eye.

## 5. Sort the layers

Each thing on screen goes into one of three groups:

- **Generated footage:** the subject, the setting and the camera move. This is what the video model makes.
- **Rebuilt graphics:** captions, titles, stickers, UI cards, charts. These are drawn again, not generated: a model spells text wrongly and cannot hold it still. Rebuild them with `motion-video`, or burn captions with `clip-cutter`.
- **Supplied assets:** a logo, a product, a face. They come from the owner's Library as references. Never invent them.

A graphic that changes on one exact frame is set on that frame, not faded in. Tween only what you saw move over several frames.

## 6. Write the shot list and the prompts

Write the recipe as JSON, one object per shot, in the fields Genfeed's storyboard already accepts: `durationSeconds`, `action`, `cuts` (each with `startSeconds`, `endSeconds`, `framing`, `camera`), `dialogue`, `sfx`, `referenceRoles` and `videoPrompt`. `startFrame` and `overlays` below are for the rebuild and the compare step; leave them out when you send shots to `edit_shots`.

```json
{
  "canvas": { "width": 1080, "height": 1920, "fps": "30/1" },
  "shots": [
    {
      "id": "shot-1",
      "startFrame": 0,
      "durationSeconds": 3.2,
      "action": "She settles onto the reformer and slides the carriage out on one slow breath.",
      "cuts": [
        { "startSeconds": 0, "endSeconds": 1.4, "framing": "wide side-on, whole body", "camera": "static, low angle" },
        { "startSeconds": 1.4, "endSeconds": 3.2, "framing": "medium close-up on the legs", "camera": "slow push in" }
      ],
      "sfx": ["soft spring creak", "breath"],
      "referenceRoles": [
        { "role": "character_face", "label": "Shayla" },
        { "role": "environment", "label": "Studio" }
      ],
      "videoPrompt": "Reference images: image 1 is the face of Shayla; image 2 is the environment (Studio). ..."
    }
  ],
  "overlays": [
    { "text": "Day 1", "fromFrame": 12, "toFrame": 90, "position": "top center", "arrival": "word by word" }
  ]
}
```

Rules for the prompts:

- One generation per shot. A generated clip never spans a cut: one take across a jump cut deletes the cut. A shot longer than the model's clip length is split where the original reframes, otherwise chained, with the last frame of one part as the start frame of the next.
- Write each prompt with the `video-realism` structure and the `cinematic-prompting` words. Describe the subject by role, never copy the source's wording for its looks or its words.
- Keep every cut under what the model renders well: a cut shorter than one second rarely does.
- Show the shot list and prompts to the owner before anything is generated.

## 7. Generate it in Genfeed

With the Genfeed MCP connected, read the options first with `get_generation_catalog` (`action: options`, `type: video`) and pick a returned model key. Never invent a model alias.

- **Realistic multi-shot recreation:** `generate_media` (`action: plan_video`) holds up to 12 shots under a minute. `create` takes the brief and a `cast` with reference asset ids; `edit_shots` takes the fields from step 6. Each paid stage (`assets`, `stills`, `draft`, `final`) is quoted first and runs only after the owner accepts the price.
- **One shot at a time:** `generate_media` (`action: media`, `type: video`) with `prompt`, `aspectRatio`, `duration`, `model`, and `references`, `characterHandles` or `imageUrl` for the subject and start frame.
- **Rebuilt graphics:** `generate_media` (`action: visual_code`) or a local `motion-video` render.
- **Join and caption:** `generate_media` (`action: transform`, `operation: merge`) joins clips with the transition you measured, and can burn captions.

Poll `check_job` until each job ends. Upload local files first with `upload_media`. Drafts only: never publish or schedule without the owner's explicit confirmation.

Without a Genfeed connection, stop at step 6 and hand over the shot list and prompts for any video tool.

## 8. Check it against the original

Run `compare ref.mp4 recreation.mp4`. It lists the original's cuts the recreation misses, the extra cuts, the canvas, frame rate, duration and sound differences, and the frames that differ most. Fix what it names and you can see: a missing cut, a wrong time, a wrong size. Regenerate only the shot that fails. Compare once more and stop. Do not chase a pixel match on generated footage; match the structure, the timing and the look.

## Hand over

Give the owner the recreation, the shot list file, and a short note: what was rebuilt, what was generated, what is approximate (a substitute font, a different lens feel), and the last compare numbers. Say what each paid stage cost only if they ask.
