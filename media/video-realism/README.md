# Video Realism

Write realistic video shot prompts as a timed shot list: numbered reference roles, the action, timestamped cuts, a spoken line and sound effects, all within the target model's reference limit.

## Installation

```bash
bunx skills add genfeedai/skills --skill video-realism
```

## Usage

```text
Write a realistic video prompt for a 6 second shot: Mia checks the kitchen clock and runs out. I have the opening still, a kitchen photo and a face photo.
```

```text
Turn this scene into a timestamped shot list with sound effects
```

```text
Assign reference roles to these four images for a multi-shot video prompt
```

## What It Does

- Gives each reference image one role (opening frame, environment, face, body and costume, prop, style) and numbers them in a fixed order.
- Writes the action, then one line per cut with start and end seconds.
- Adds the spoken line and sound effects only for models that render sound.
- Keeps the image count within what the model accepts.

Use `cinematic-prompting` for the camera and framing vocabulary inside each cut.
