---
name: threejs-previs
description: Build a stick-figure and coloured-block Three.js mockup of a video shot instead of a Blender previs, render it locally to a reference video, then write the video-model prompt (Seedance first) that maps every colour to the subject, prop, place or frame it stands for and passes the mockup as the motion and camera reference. Triggers on "previs", "three.js mockup", "stickman mockup", "blocking mockup", "layout video for seedance", "replace blender previs", "reference video for seedance", "plan camera and motion before generating".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
  short-description: "Mock up a shot with stick figures and coloured blocks in Three.js, render it to a reference video and write the Seedance prompt that maps each colour to what it represents."
  tags: video, previs, threejs, seedance, reference-to-video, camera, storyboard, local
  outputs: files, json, text
  triggers: "previs; three.js mockup; stickman mockup; blocking mockup; layout video for seedance; replace blender previs; reference video for seedance; plan camera and motion before generating"
---

# Three.js Previs

A video model follows a reference video's camera path, blocking and timing better than it follows a paragraph about them. This skill gives you that reference without opening Blender: you describe the shot as a small JSON scene of stick figures and coloured blocks, render it on this machine with Three.js, and write the prompt that tells the model what each colour is.

Pick it when the layout matters: where people stand, how they move, and how the camera travels. For a plain one-line idea, a text prompt is quicker. To get a layout from a clip that already exists, use `reverse-video` instead.

The mockup is a guide, not footage. It is never the first frame, and nothing in it should show up in the result.

## Ask for these first

1. The shot in a sentence or two: who is in it, what they do, where, and how the camera moves.
2. The video model and the host (BytePlus, Replicate, fal or Genfeed). If they have not chosen, recommend Seedance 2.5 on Genfeed or Seedance 2.0 on the host they already use, and say why: both take reference videos.
3. Aspect ratio and length. Match the length to one the model generates (see the table below).
4. The images they already have for the subjects, props or places (character sheets, a product shot, a location photo). Each one becomes an image reference.

## Which models take a reference video

Read 2026-11-24. Check again before relying on a limit; hosts change them.

| Model and host | Reference video | Limits | Prompt tag | Source |
| --- | --- | --- | --- | --- |
| Seedance 2.0, 2.0 fast, 2.0 mini on BytePlus ModelArk | Yes, role `reference_video` | Up to 3 videos, each 2 to 15 s, 15 s in total, mp4 or mov (H.264 or H.265), 24 to 60 fps, under 200 MB each, 0.4 to 2.5 aspect ratio, 300 to 6000 px a side, 407,696 to 8,295,044 pixels | `Video 1` | BytePlus `seedance-2-0` and `video-generation-tutorial` docs |
| Seedance 2.5 on BytePlus | Yes | Up to 10 videos, each 2 to 30 s, 30 s in total, up to 8,847,360 pixels (flash: 5 videos) | `Video 1` | BytePlus `seedance-2-5` and `video-generation-tutorial` docs |
| Seedance 2.0, 2.0 fast, 2.5 on Replicate | Yes, field `reference_videos` | Up to 3 videos and 15 s in total for 2.0; up to 10 videos and 30 s in total for 2.5 | `[Video1]` | Replicate model schemas, read through its API |
| Seedance 2.0 on fal (`reference-to-video`) | Yes, field `video_urls` | Up to 3 videos, 2 to 15 s combined, under 50 MB in total, about 480p to 720p each | `@Video1` | fal model page |
| Genfeed | `videoReferences` on `generate_media`, for models that support it | The live catalog differs per brand: one brand lists Seedance 2.5 and the MiniMax H3 family. The code marks Seedance 2.5, Kling V3 Omni and MiniMax H3 as taking video references | n/a | `get_generation_catalog` and the `genfeed.ai` model capability constants |

Genfeed's brief compiler sends video references to `reference_videos` for its Seedance 2.0, 2.0 fast and 2.5 profiles (read in `genfeed.ai` at 66cfaadc).

`720x1280` (or `1280x720`) satisfies every row, including fal's narrower range. It is the default in the `chase` scene. For a cheap draft, `480x854` is the smallest 9:16 canvas above the 407,696-pixel floor (409,920); the `street-taxi` scene uses it. Ask the model for 480p as well.

### What is not verified

- **Colour-to-object mapping on a mockup, beyond one trial.** BytePlus documents "define the tall man in Video 1 as the police officer" for real footage and does not document stick figures or coloured blocks. See "Tested once" below: it held in one run. A draft render is still the only proof for your shot.
- **Seedance 2.0, 2.0 fast and 2.0 mini, and any host other than Genfeed.** The trial ran Seedance 2.5 through Genfeed only. The 2.0 limits and the BytePlus, Replicate and fal field names come from their docs and schemas.
- **Kling V3 Omni and the MiniMax H3 family.** Genfeed marks them as taking video references. What a reference video does in them was not checked against their own docs.
- **Moderation of a stick figure input.** BytePlus does not accept reference images or videos that contain real human faces. A stick figure has no face, but this was not tested.
- **Models without a reference video input** (Veo, Wan 2.2 I2V Fast, Hailuo). Use the fallback at the end of step 6.

### Tested once

On 2026-11-24 the `street-taxi` scene (`templates/street-taxi.scene.json`) went through the whole path: `render`, `upload_media`, then `generate_media` on `bytedance/seedance-2.5` through Genfeed with `videoReferences`, 480p, 4 s, `harness: false` (exact prompt text), and the draft prompt from `prompt` unedited. The estimate was 137 credits. Result:

- The red stick figure became the woman in a green parka and white sneakers, walking toward the camera. The blue block became a yellow taxi crossing behind her left to right at about the same moment. The yellow panel became a glowing shop window at the left. No stick figure, block, grid or label appeared.
- Rough spots: the woman began nearer the centre than in the mockup, the pull-back was gentler than drawn, and the clip came back with an audio track although the quote assumed none.
- The previs colours were chosen so none matched the real colour (a blue block for a yellow taxi). A wrong colour in the result would then have shown the mapping failing.

One trial on one model: it shows the method can work, not that it always does.

## Run it

Needs [Bun](https://bun.sh) 1.1+, Chrome or Chromium, and `ffmpeg` and `ffprobe` on PATH. Three.js is the only package; it installs once, pinned, into `runtime/`.

```bash
bun run scripts/previs.ts setup                      # once: installs three.js 0.187.0
bun run scripts/previs.ts init ./my-shot             # writes my-shot/scene.json (--template chase | street-taxi)
bun run scripts/previs.ts validate my-shot/scene.json --target seedance-2.0
bun run scripts/previs.ts render my-shot/scene.json --target seedance-2.0
bun run scripts/previs.ts prompt my-shot/scene.json --target seedance-2.0 --ref-style byteplus
bun run scripts/previs.ts check my-shot/out/previs.mp4 --target seedance-2.0
```

Set `CHROME_PATH` if Chrome is not found. `--target` is `seedance-2.0` or `seedance-2.5`; it checks the canvas, fps and length against that model's reference limits and fails when one is broken. `--ref-style` is `byteplus`, `replicate` or `fal` and sets how the prompt names `Video 1` and `Image 1`.

`render` writes three things into `out/`:

| File | What it is for |
| --- | --- |
| `previs.mp4` | The clean reference video. This is the only file you send to the model. |
| `previs-review.mp4` and `previs-sheet.png` | The same shot with a label over every entity and the time in the corner, and eight frames side by side. For you and the owner to check. Never send these: the labels would leak into the result. |
| `legend.json` | Every entity with its colour name, kind and what it represents. |

## 1. Choose the colour code

Every entity gets one flat colour and its own colour name. Use the palette below so the colours stay far apart. `validate` refuses two entities that share a colour name, and warns when a colour is close to the grey floor.

| Name | Hex | Name | Hex |
| --- | --- | --- | --- |
| red | `#e02020` | teal | `#00a6a6` |
| orange | `#f08c00` | purple | `#8a2be2` |
| yellow | `#f2d000` | pink | `#ff4fa3` |
| green | `#2eb82e` | brown | `#8b5a2b` |
| blue | `#1f6fe0` | black | `#151515` |

White and grey are legal but blend into the floor and the sky, so keep them for last. Use six colours or fewer in one shot; the model has to keep each one apart.

## 2. Say what each entity is

Each entity has a `kind`, which decides how it is drawn and how the prompt talks about it.

| Kind | Default shape | Use it for | Prompt wording |
| --- | --- | --- | --- |
| `subject` | `stickman` | A person or character who acts | "Define the red stick figure in Video 1 as ..." |
| `prop` | `block` (also `cylinder`, `sphere`) | An object that moves or must keep its look: a car, a bag, a ball | "Define the blue block in Video 1 as ..." |
| `place` | `zone` (a flat patch on the floor), or `wall` | Where something happens: a street, a kitchen floor, a back wall | "The green floor patch in Video 1 marks ..." |
| `frame` | `panel` (a thin upright rectangle) | A flat surface that shows an image: a phone or TV screen, a billboard, a window, a poster | "The yellow flat panel in Video 1 is ..." |

A `frame` stands for something the camera sees as a picture inside the shot. Point its `reference` at the image that should appear there. It is not the opening frame of the video.

The fields that matter on every entity:

| Field | Meaning |
| --- | --- |
| `id` | Lowercase letters, digits and dashes. Tracks use it. |
| `label` | A short name, for example `Mia`. Shown in the review render and used in the timeline. |
| `represents` | What it is in the finished video, in plain words: "Mia, a courier in a yellow rain jacket". The prompt copies this text. |
| `reference` | An image you have for it (a Library label or a path). Images are numbered in entity order. |
| `color`, `colorName` | A `#rrggbb` hex. `colorName` is optional; the nearest palette name is used. |
| `size` | `[width, height, depth]` in metres. Cylinders and spheres use the width as the diameter. |
| `position`, `yaw` | Where it stands when it has no track, and the degrees it faces (0 faces +z, toward the default camera). |
| `height` | A stick figure's height in metres. Default 1.7. |

Describe each one by what it looks like, not by a real person's name or a brand. Never describe a real person's face; use the owner's own approved reference images.

## 3. Write the motion and the camera

The world is in metres: x is right, y is up, +z points toward the default camera, and the floor is y = 0.

- `tracks` maps an entity id to keys `{ "t": seconds, "position": [x, y, z] }`. Positions blend in a straight line between keys. A stick figure turns to face where it is heading, walks below 2.2 m/s and runs above it. Add `"pose": "sit"` or `"fall"` on a key to change its posture from that time; `"yaw"` overrides the heading.
- `camera` is a list of keys `{ "t", "position", "lookAt", "fov", "ease" }`. `"ease": "inOut"` softens the start and end of a move. `"cut": true` on a key jumps there with no move, which is a hard cut.
- Use one kind of camera move per stretch (push in, pull back, track, orbit, crane, pan). BytePlus's prompt guide advises one camera move per shot, and a mockup that mixes three gives the model nothing clear to follow.
- Make the subject large enough to read in the frame, so the model can tell which colour is the subject.
- Hold the first and the last key for a second (repeat the same key a second later), so the layout is clear at both ends of the clip.

Choose the length from what the model generates. Genfeed lists these for Seedance 2.5: 4, 5, 8, 10, 15, 20 and 30 s; for Seedance 2.0: 5, 10 and 15 s. A previs of 8 s for 2.5, or 10 s for 2.0, maps one to one. Seedance 2.0 generates 4 to 15 s, so a shorter reference leaves the rest of the clip unguided, and `validate` says so.

For a cut-together shot, either put `cut` keys in one scene, or render one scene per shot and send them as `Video 1`, `Video 2` and `Video 3`. The total of all reference videos stays within the table's limit.

## 4. Render and look

```bash
bun run scripts/previs.ts validate shot/scene.json --target seedance-2.0
bun run scripts/previs.ts render shot/scene.json --target seedance-2.0
```

Look at `out/previs-sheet.png` before anything is generated. Check these, and fix the JSON, not the prompt:

- Every subject, prop, place and frame you named is visible at some moment, and none is hidden behind a block.
- The camera path matches what was asked: the right side of the subject, the right direction, the right pace.
- Nobody walks through a block, and no one leaves the frame for good unless they should.
- Colours read as the palette colours, and none merges with the floor or the sky.

Rendering both videos of an 8 s shot at 720x1280 took about 25 seconds with software WebGL. `render` exits non-zero when the clean video breaks the target's limits.

## 5. Write the prompt

```bash
bun run scripts/previs.ts prompt shot/scene.json --target seedance-2.0 --ref-style byteplus --out shot/prompt.md
```

It writes the reference inputs in order and a first draft of the prompt. The draft covers four things, in this order:

1. **What the video is.** "Video 1 is a rough 3D layout mockup ... Use it only as the reference for camera movement, blocking, timing and spatial layout."
2. **The mapping.** One sentence per entity, built from `represents`: "Define the red stick figure in Video 1 as Mia, ..., with the look taken from Image 1." Places and frames use "marks" and "is".
3. **Setting and style** from the scene's `setting` and `style` fields.
4. **A timeline** worked out from the keyframes: which way each subject moves relative to the camera and how the camera moves, in seconds. Then a closing line telling the model not to show stick figures, blocks, grid lines, labels or the grey floor.

Then edit it. The timeline is a draft built from numbers, so read it against the sheet and fix the wording. Rules that come from BytePlus's own prompt guide:

- Use the same label every time a subject is mentioned. Pick it once ("the courier") and keep it. Do not describe one subject two ways.
- Refer to assets as asset type plus number, counted in request order within each type: `Video 1`, `Image 2`. Never an asset ID.
- Put the visual facts in the images and the layout in the video; keep the text short. Avoid words that contradict the mockup (a subject "standing still" while its stick figure walks).
- Add the sound, the spoken line and the finishing look in your own words. The mockup has no audio.
- Keep the prompt under 4,000 characters (Replicate's limit) and about 600 words (BytePlus's advice). The draft warns when it is over.

For wording of the camera, light and lens use `cinematic-prompting`. For a multi-shot prompt with timed cuts and reference roles use `video-realism`.

## 6. Generate

Run a short, cheap draft first to see whether the model reads the colours as you meant. Change one thing at a time: the label wording, the image order, the size of the subject.

### With the Genfeed MCP

Read the options and pick a returned key; never invent a model alias.

1. `get_generation_catalog` with `action: options` and `type: video`. Choose a model that takes video references, such as the Seedance 2.5 key it returns. Check the key for the brand you are in.
2. Upload the clean video: `upload_media` with `action: request`, `category: video`, `contentType: video/mp4`, then send the bytes to the returned `uploadUrl` with the returned method and headers, then `upload_media` with `action: complete`. The result gives an asset id. Upload the images the same way with `category: image`.
3. `generate_media` with `action: media` and `type: video`: `prompt` (from step 5), `model`, `aspectRatio`, `duration`, `videoReferences` (the previs asset id) and `references` (the image asset ids, in the order the prompt numbers them). Do not pass the previs as `imageUrl`; that is the first frame.
4. Poll `check_job` until the job ends. Say what a paid render costs before you start it, and make drafts only: never publish or schedule without the owner's explicit confirmation.

### Without Genfeed

Send the same inputs to the host's own API, using the field names in the table above: BytePlus `content` items with role `reference_video` and `reference_image`, Replicate `reference_videos` and `reference_images`, fal `video_urls` and `image_urls`. The prompt text is the same; only the tag style (`--ref-style`) changes.

### A model with no reference video input

Do not feed the mockup as a first frame: the result would start with stick figures. Instead keep the timeline from step 5 and send it as a storyboard: each timeline line becomes a shot's `action`, with `cuts` holding the framing and camera words, through `generate_media` with `action: plan_video` (see `video-realism`). The mockup is then only your own check. This route was not run for this skill.

## Hand over

Give the owner the clean `previs.mp4`, the review video and sheet, the final `prompt.md`, and a short note: the model and host, what each reference is (Video 1, Image 1, and so on), the limits you checked, and what is unverified (see the list above). Say if the draft showed the model ignoring a colour, and what you changed.

Related: `reverse-video` builds a shot list from an existing clip, `cinematic-prompting` supplies camera and light words, and `video-realism` structures multi-shot prompts.
