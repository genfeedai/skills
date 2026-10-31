---
name: ugc-ad-prompts
description: Free prompt pack for UGC-style video ads. Write selfie, talking-head and screen-demo ad prompts in a 13-section structure with fill-in templates, camera modes and a pre-flight checklist. Triggers on UGC ad prompt, selfie ad, talking head ad, screen demo ad, phone-shot ad video, and creator-style video ad.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# UGC Ad Prompts

A free prompt pack for short, phone-shot looking video ads. It gives you one prompt structure, three ready formats (selfie ad, talking head, screen demo), three camera modes and a checklist to run before you spend credits on a render.

The structure is the one Genfeed's ad presets compile. The section order and wording below match the preset templates, and a prompt written here pastes into any video model.

## How to use this pack

1. Pick a format: selfie ad, talking head or screen demo.
2. Pick a camera mode if the format allows it (selfie, tripod, filmed by someone else).
3. Fill the `{{placeholders}}` in the template. Write the dialogue first.
4. Run the pre-flight checklist at the end.
5. Render one clip, then change one section at a time. Changing five sections at once tells you nothing.

## The 13 sections

Every prompt in this pack uses these sections in this order. Skip none: an empty section is where the model improvises.

| # | Section | What it decides |
|---|---------|-----------------|
| 1 | Generation Goal | Aspect ratio and length |
| 2 | No Words On Screen | Stops generated captions, titles and logos |
| 3 | Reference Material Roles | What each attached image, clip or audio file is for |
| 4 | Dialogue | The exact spoken words |
| 5 | Subjects and Relationships | Who is on screen and how they relate to the setting |
| 6 | Scale and Proportion | Keeps anatomy and objects realistic |
| 7 | Camera | Lens, framing, movement |
| 8 | Picture Quality | The look: phone-quality or clean studio |
| 9 | Lighting | One consistent light |
| 10 | Performance | How the person speaks and moves |
| 11 | Event Script | Beginning, middle and end of the clip |
| 12 | Audio | What the audio reference does |
| 13 | Maintain Consistency | Identity, wardrobe, setting and light stay fixed |

## Parameters

Fill these once, then reuse them across the sections.

| Parameter | Example | Notes |
|-----------|---------|-------|
| `aspectRatio` | `9:16` | 9:16 for Reels, TikTok and Shorts; 1:1 or 4:5 for feed |
| `duration` | `7` | Seconds. If you attach a voice recording, never go shorter than it |
| `lensMm` | `24` | The preset examples use 24 mm; change it only if the framing is wrong |
| `qualityLook` | `Low-quality phone selfie` | Or `Clean studio video` for talking heads |
| `dialogue` | `Try this.` | The exact words, written first |
| `referenceRoles` | `@Image1 is the person. @Audio1 is the voiceover.` | One role per attached file |

## Format 1: UGC selfie ad

A casual handheld selfie. Best for product reactions, "I tried it" hooks and testimonials.

```text
Generation Goal: Create a {{aspectRatio}} video lasting {{duration}} seconds.

No Words On Screen: Do not add captions, titles, logos or other generated words on screen.

Reference Material Roles: {{referenceRoles}}

Dialogue: Say "{{dialogue}}". Use the same words, same number of words, same order.

Subjects and Relationships: Keep the referenced person recognizable and interacting naturally with the setting.

Scale and Proportion: Keep human anatomy, objects and surroundings at realistic proportions.

Camera: Handheld phone selfie, {{lensMm}} mm lens, {{aspectRatio}}; subtle natural movement.

Picture Quality: {{qualityLook}}

Lighting: Use believable, consistent light that suits the setting.

Performance: Speak naturally with restrained gestures and expressions.

Event Script: Start with an attentive look, deliver the dialogue, then settle naturally.

Audio: Reference audio steers the voice. There is no unchanged-audio guarantee.

Maintain Consistency: Maintain identity, wardrobe, setting and lighting throughout.
```

### Worked example

Inputs: `aspectRatio` 9:16, `duration` 7, `lensMm` 24, `qualityLook` "Low-quality phone selfie", `dialogue` "Three weeks in and this bottle still keeps my coffee hot."

```text
Generation Goal: Create a 9:16 video lasting 7 seconds.

No Words On Screen: Do not add captions, titles, logos or other generated words on screen.

Reference Material Roles: @Image1 is the person. @Image2 is the location, a bright kitchen.

Dialogue: Say "Three weeks in and this bottle still keeps my coffee hot." Use the same words, same number of words, same order.

Subjects and Relationships: Keep the referenced person recognizable and interacting naturally with the setting.

Scale and Proportion: Keep human anatomy, objects and surroundings at realistic proportions.

Camera: Handheld phone selfie, 24 mm lens, 9:16; subtle natural movement.

Picture Quality: Low-quality phone selfie

Lighting: Use believable, consistent light that suits the setting.

Performance: Speak naturally with restrained gestures and expressions.

Event Script: Start with an attentive look, deliver the dialogue, then settle naturally.

Audio: Reference audio steers the voice. There is no unchanged-audio guarantee.

Maintain Consistency: Maintain identity, wardrobe, setting and lighting throughout.
```

## Format 2: Talking head

A direct-to-camera presentation. Best for explainers, announcements and founder-to-camera ads.

Use the selfie template with two changes:

- Camera: `{{lensMm}} mm lens; compose for {{aspectRatio}}.` (a stable frame instead of handheld movement)
- Picture Quality: a clean look such as `Clean studio video` when the brand is polished, or keep a phone look for authenticity.

Every other section is identical, so the dialogue, consistency and no-words rules carry over.

## Format 3: Screen demo

A narrated demonstration of an app or page. The person is the voice; the screen is the star.

Use the selfie template with these changes:

- Reference Material Roles: add the screen recording or screenshot, for example `@Image1 is the person. @Image2 is the screen content. @Audio1 is the voiceover.`
- Subjects and Relationships: `Show the referenced screen content clearly while the voiceover explains it.`
- Camera: `{{lensMm}} mm lens; compose for {{aspectRatio}}.`

Keep the screen readable by writing what must be visible in the Event Script, for example `Show the checkout screen for the whole clip.` Generated video models often garble small text, so prefer a screen reference you supply over describing the screen in words.

## Camera modes

Three camera looks cover most phone-shot ads. Add the matching block to the Camera and Maintain Consistency sections.

| Mode | When to use | Camera block |
|------|-------------|--------------|
| Selfie handheld | Reactions, testimonials | `Amateur phone selfie: front-facing smartphone, handheld selfie sway and breathing motion, no jitter, no zoom, no gimbal smoothness.` |
| Tripod vlog | Explainers, "talk to the camera" | `Amateur phone vlog: smartphone mounted on a tripod, static locked-off frame, no pan, no tilt, no zoom.` |
| Filmed by another person | Product in use, walk-and-talk | `Amateur phone clip filmed by another person standing nearby: rear camera at eye level, slight operator sway, no gimbal smoothness, no zoom.` |

Framing anchors keep the shot from drifting between frames. Add the one that matches your mode:

- Selfie: `Keep consistent selfie framing, eyes near the upper third, same camera height, clothing, accessories, light, exposure, and white balance throughout.`
- Tripod: `Keep consistent framing with the phone-on-tripod in shot, locked talking-head crop, same camera height, clothing, accessories, light, exposure, and white balance throughout.`
- Filmed by another: `Keep consistent medium shot as filmed by another person, same camera height, clothing, accessories, light, exposure, and white balance throughout.`

## Reusable blocks

Paste these into Performance and Maintain Consistency when the first render shows a problem.

**Identity lock.** Use when the face changes between frames:

```text
Identity lock: do not alter facial proportions, eye shape, or hairstyle; keep natural skin texture. Exclude drift in identity, face, glasses, hair, wardrobe, skin tone, background, camera, lighting, fingers, hands, dialogue, text, logo, watermark, or extra people.
```

**Presenter pacing.** Use when the delivery looks robotic or the hands cover the face:

```text
Natural talking-head pacing: a small eyebrow raise on key clauses, controlled pauses between thoughts, and brief facial stillness after each phrase. Tie exactly one physically plausible gesture to one phrase so the movement ends before a quiet tail hold. End the clip with a settled face and a closed, resting mouth. Keep hands below the collarbone, away from the face and lens, or out of frame.
```

## Writing dialogue that renders well

- Write for the ear, not the page. Short sentences, one idea each.
- Fit the words to the time. A comfortable speaking pace is a little over two words per second, so 7 seconds holds about 15 words. This is a rule of thumb, not a model guarantee.
- Put the hook in the first sentence. The first two seconds decide whether anyone keeps watching.
- Write numbers and names the way they should be said aloud.
- State the dialogue once, in the Dialogue section only. Genfeed's compiler inserts it exactly once, and the other sections never repeat it.

## Audio reference notes

If you attach a recording as the voice reference, it steers the voice. It does not guarantee the model keeps your words or timing unchanged, so always check the render against the script. Keep the clip duration at or above the recording length so the model does not cut the voice off.

## Pre-flight checklist

Run this before you render:

- [ ] Dialogue is written once, in quotes, and fits the duration.
- [ ] Every attached file has exactly one role in Reference Material Roles.
- [ ] The prompt says no words on screen.
- [ ] Camera mode and framing anchor match the format.
- [ ] Lighting and setting are named once and not contradicted elsewhere.
- [ ] Duration is not shorter than any voice recording.
- [ ] You change one section per re-render.

## Common failures and the section to change

| What you see | Change this |
|--------------|-------------|
| Captions or logos appear | No Words On Screen: restate it; add `watermark, text, logo` to the identity-lock exclusions |
| Face drifts between frames | Add the identity lock block; keep one reference image |
| Hands cover the face | Add the presenter pacing block |
| Camera moves too much | Switch to tripod mode, or restate `no pan, no tilt, no zoom` |
| Lips and words do not match | Shorten the dialogue; check duration against the recording |
| The room changes mid-clip | Maintain Consistency: name the setting and light explicitly |

## Genfeed Integration

This pack works in any prompt box. The same 13 sections are what Genfeed's ad presets compile, so a prompt from this pack also works in a Genfeed workspace. Learn more at [genfeed.ai/agent](https://genfeed.ai/agent).
