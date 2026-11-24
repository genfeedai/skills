---
name: reverse-image
description: Break an image down into its composition (framing, subject placement, lens, camera angle, lighting, palette, grade, texture, setting) and write one reproducible prompt for it, then generate with your own subject and check it against the reference. Triggers on "reverse engineer this image", "describe this photo as a prompt", "recreate this shot", "what lens and lighting is this", "break down this image's composition", "copy the look of this photo", "image to prompt".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
  short-description: "Break an image down into framing, lens, lighting, palette and style, write one reproducible prompt, and check the recreation against the reference."
  tags: image, reverse-engineering, composition, lighting, prompt, photography, recreate
  outputs: text, json
  triggers: "reverse engineer this image; describe this photo as a prompt; recreate this shot; what lens and lighting is this; break down this image's composition; copy the look of this photo; image to prompt"
---

# Reverse Image

You take a reference image and write down exactly how it was made: how it is framed, what lens and camera angle it has, how it is lit, its colours and grade, and what is in it. Then you turn that into one prompt another model can follow, generate with the owner's own subject, and check the result against the reference.

This recreates the composition and look, not the picture. The new image has a new subject and no copied person, mark or text. Never reproduce a real person's face or likeness, a watermark or a logo that is not the owner's. Work only on images the owner has the right to study.

Use `cinematic-prompting` for the lens and lighting words, `image-prompt-engineer` for the final prompt format of each model, and `reverse-video` when the reference is a video.

## Ask for these first

1. The reference image, and what the owner likes about it (the pose, the light, the mood, the colour).
2. The subject that replaces the original: a character, persona or product, with its reference images in the Library.
3. The aspect ratio and where it will be posted.

## 1. Read the canvas

```bash
ffprobe -v error -show_entries stream=width,height -of csv=p=0 ref.jpg
```

Write down the aspect ratio. A 4:5 portrait, a 9:16 story and a 1:1 square compose differently, and the prompt must name the ratio.

Lay a thirds grid over the image to read subject placement honestly, and pull the main colours:

```bash
ffmpeg -y -i ref.jpg -vf "drawgrid=w=iw/3:h=ih/3:t=2:c=white@0.7" out/grid.png
ffmpeg -y -i ref.jpg -vf "palettegen=max_colors=6:stats_mode=full" out/palette.png
```

Look at both files. The palette file is six swatches: read their colours and write them as names with rough hex values.

## 2. Break it down

Fill every row from what you see. If a row cannot be told from the image, write "unclear" and do not guess.

| Field | What to write |
| --- | --- |
| Frame | Aspect ratio, shot size (extreme close-up, close-up, medium, full body, wide), crop (what is cut off at the edges) |
| Placement | Where the subject sits against the thirds grid, how much of the frame it fills, headroom, where the eyes are, leading lines |
| Camera | Height (below eye level, eye level, above), angle (straight on, three-quarter, profile, top-down), tilt of the horizon |
| Lens | Feel: wide (stretched edges, deep space), normal, or telephoto (compressed background). A focal length range as an estimate, never as a fact. Distance to the subject |
| Focus | Depth of field: razor thin, shallow, or deep. What is sharp, what is soft, the quality of the blur |
| Light | Key direction (front, side, back, top), hard or soft, colour temperature, fill and contrast, rim or edge light, practical lights, shadow shape, catchlights in the eyes |
| Colour | Dominant and accent colours, saturation, contrast, how skin and whites render |
| Grade | Warm or cool, lifted blacks, faded, high contrast, film stock or digital feel, grain, halation, vignette |
| Subject | Pose, expression, wardrobe, hair, props, in plain nouns |
| Setting | Location, background elements, time of day, weather |
| Text | Any words, their font traits and position. Text is added afterwards, not generated |
| Style | Photograph, illustration, 3D, or mixed. The era and the feel, described by feel, never by an artist's name |

## 3. Write the prompt

Write one prompt in this order, one clause each, so it can be changed one part at a time:

1. Subject and action (the owner's subject, not the original's).
2. Setting and time.
3. Frame and placement: shot size, crop, where the subject sits.
4. Camera height and angle, lens feel and depth of field.
5. Light: key direction, quality, colour temperature, accents.
6. Colour and grade, grain and texture.
7. Aspect ratio.

Then add a short "avoid" line for what the reference does not have (extra fingers, text, a plastic skin look, a different time of day). Keep the original's wording for its looks out of the prompt: describe the effect, not the person.

Return both the breakdown table and the prompt, so the owner can edit either.

## 4. Generate it in Genfeed

With the Genfeed MCP connected, call `get_generation_catalog` (`action: options`, `type: image`) and pass a returned model key. Never invent a model alias. Then call `generate_media` (`action: media`, `type: image`) with the `prompt`, `aspectRatio`, `model`, and `references` or `characterHandles` for the subject so it stays the same person across posts. Poll `check_job` until the job ends. Say what a generation costs before running it, and show the prompt first.

Without a Genfeed connection, hand over the breakdown and prompt for any image tool.

## 5. Check it against the reference

Put the two side by side and look at them with the thirds grid on both:

```bash
ffmpeg -y -i ref.jpg -i result.jpg -filter_complex "[0:v]scale=-2:900[a];[1:v]scale=-2:900[b];[a][b]hstack" out/side.png
```

Compare in this order: frame and placement, camera height, light direction, colour and grade, then detail. Name the one thing that is furthest off and change only that clause of the prompt. Run it again. Two rounds are enough: stop and say what is still different instead of looping.

## Hand over

Give the owner the breakdown, the final prompt, the model key used, and one line on what still differs from the reference. Drafts only: never publish or schedule without the owner's explicit confirmation.
