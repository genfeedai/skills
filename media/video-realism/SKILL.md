---
name: video-realism
description: Write a realistic video shot prompt as a timed shot list with reference roles, a spoken line and sound effects. Triggers on "realistic video prompt", "shot list prompt", "timestamped shots", "reference roles", "multi-shot video prompt", "video with sound effects", "storyboard shot prompt".
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Video Realism

You turn a rough scene description into one prompt per shot that a reference-to-video model can follow. The prompt has a fixed structure: which reference image plays which role, the action, timed cuts inside the shot, then sound. Genfeed's storyboard compiles the same structure, so a prompt written here and a prompt compiled in Studio read the same way.

Use `cinematic-prompting` for the camera and framing words inside each cut. This skill decides the structure, not the vocabulary.

## Ask for these first

1. The scene in a sentence or two, and how long the shot runs (seconds).
2. The reference images the user has, and what each one shows.
3. Whether the target model renders sound. If it does not, leave the spoken line and sound effects out.
4. How many reference images the model accepts. Never name more than that.

## Reference roles

Give every reference image exactly one role. Number them in this order, after the opening frame when there is one:

| Role | Phrase in the prompt | Use it for |
| --- | --- | --- |
| opening frame | the opening frame | The still the shot starts from. Always image 1 when present. |
| environment | the environment (label) | The location, set or room. |
| character_face | the face of label | A close reference of one person's face. |
| character_body | the body and costume of label | Full body, clothing and build. |
| prop | the prop (label) | An object that must look the same in every shot. |
| style | the visual style to match | Grade, lens look or art direction. |

Count the images before writing. If the shot needs more than the model accepts, drop a role or pick another model. Do not merge two roles into one image.

## Prompt structure

Write the parts in this order, each as a short sentence:

1. `Reference images: image 1 is the opening frame; image 2 is the environment (Kitchen); image 3 is the face of Mia.` Only when at least one image has a role.
2. The action: who does what, in present tense.
3. One line per cut, in seconds from the start of the shot: `0-2s: Close-up on the clock.` `2-6s: Side profile of Mia, handheld tracking.` Cuts follow each other, never overlap, and end inside the shot.
4. `Spoken line: "I am late."` Only for a model with sound.
5. `Sound effects: ticking clock, door slam.` Only for a model with sound. Name concrete sounds, at most eight.
6. `Keep every person consistent with the reference images.` When a person has a reference image.
7. `Visual style: warm tungsten interior, shallow depth of field.` When the user gave a style.

## Rules

- One shot, one prompt. Two to four cuts per shot is the useful range; a cut shorter than one second rarely renders.
- Keep the whole prompt under 4,000 characters.
- Keep names identical to the cast names. The model links "Mia" in the action to "the face of Mia" in the preamble.
- Do not describe what a reference image already shows. Point at it by its role.
- Show the finished prompts to the user before anything is generated. Rendering costs credits.

## Example

Input: a 6 second shot. Mia, late for work, checks the kitchen clock and runs out. References: the opening still, a photo of the kitchen, a face photo of Mia. The model renders sound and takes four images.

Output:

```text
Reference images: image 1 is the opening frame; image 2 is the environment (Kitchen); image 3 is the face of Mia. Mia checks the clock and runs for the door. 0-2s: Close-up on the clock. 2-6s: Side profile of Mia, handheld tracking. Spoken line: "I am late." Sound effects: ticking clock, door slam. Keep every person consistent with the reference images.
```

## In Genfeed

In Studio, a storyboard shot holds these parts as fields: cuts, sound effects, reference roles and an optional prompt of your own. Studio shows the compiled prompt for the storyboard's video model before any render, and refuses a render that names more images than the model accepts. Draft renders use the same prompt as the final, so a draft you like can be promoted unchanged.
