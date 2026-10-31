---
name: tiktok-title
description: Write the TikTok video title layer, meaning the on-screen hook, the cover text and the searchable first line of the caption. Use when a TikTok needs a title, cover text, a hook line or title variants.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# TikTok Title

TikTok has no separate title box in the app. A "title" is three things that must agree: the on-screen hook in the first seconds, the cover text, and the first line of the caption. In TikTok's Content Posting API the whole caption is sent in a field named `title`, up to 2,200 UTF-16 runes (the official direct-post reference). Writing the caption is [tiktok-description](../tiktok-description/SKILL.md); this skill writes the headline layer.

## Inputs

- The clip or its transcript, with the one claim it makes.
- The channel's video brand profile (`video-brand-profile`) for font, case, colors and spelling.

## Workflow

1. Write the clip's claim in one sentence, in the speaker's words.
2. Make the **on-screen hook**: 3 to 7 words, shown in the first second or two, naming the subject and the tension.
3. Make the **cover text**: at most 5 words, a different angle from the hook so the grid and the first frame do not repeat each other.
4. Make the **first caption line**: a plain sentence with the search words a viewer would type, at most about 90 characters so it is not cut in feeds.
5. Check that the three tell the same truth.

## Rules

- Name the subject (tool, company, number) before the adjective.
- No bait ("wait for it", "you won't believe", "agree?"). No claims stronger than the recording.
- Title the observable result: "Claude built a CAD app in one prompt", not "Testing Claude".
- Use the profile's font and case for on-screen text. Keep text out of the interface zones (see [tiktok-video](../tiktok-video/SKILL.md)).
- Do not put hashtags in the on-screen text. They belong in the caption.
- Spell product and channel names exactly.

## Output

```markdown
### Title layer for <clip>
- Claim:
- On-screen hook (3 to 7 words):
- Cover text (up to 5 words):
- First caption line:
- Alternates: 2 more hook and cover pairs
- Check: spelling, claim matches the recording, text inside the safe area
```
