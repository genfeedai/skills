---
name: youtube-description
description: Write YouTube descriptions for recaps, livestreams and Shorts with an opener, takeaway, accurate chapters, sources, links and the channel footer. Use when writing or fixing a video description, chapters or a Shorts caption.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# YouTube Description

Write for the viewer first and search second. The first lines are what people see before "more".

## Inputs

- The real asset and its transcript or timed notes, so chapters use the video's own clock.
- The channel's video brand profile (`video-brand-profile`) for the footer, link rules and spelling.
- Links that exist: sources the video used, the full episode for a clip, example code, the product.

## Structure for a recap or livestream

1. **Opener.** One or two human sentences that say what the video settles. No greeting, no "in this video we".
2. **Takeaway.** The specific thing the viewer will know or be able to do. Use words the speakers used.
3. **Chapters.** Accurate timestamps, below.
4. **Sources and links.** What the video referenced, labeled by what it is. Links to example code or notes if they exist.
5. **Footer.** The profile's channel footer, unchanged.

## Chapters

YouTube Help requires, for automatic chapters: a first timestamp of `0:00`, at least three timestamps in ascending order, and at least 10 seconds per chapter. Recheck the current rule: <https://support.google.com/youtube/answer/9884579>.

- Use the clock of the video being described. A recap's chapters are not the livestream's timestamps.
- Name each chapter by its subject, not "Part 2".
- Check each timestamp against the player before publishing.

## Shorts caption

- Sentence 1 repeats the hook in different words.
- Sentence 2 adds the one fact that makes the clip stand alone.
- Link the full episode on its own line.
- 3 to 5 specific hashtags at the end. Skip hashtags that do not describe the content.

## Limits

- Description: 5,000 bytes. Non-ASCII characters use more than one byte, so leave room.
- Tags: use a short list for spelling and ambiguity, not as a growth lever.
- Hashtags in the description can appear above the title. Use them on purpose.

## Rules

- Say only what the video says. No invented quotes, results or endorsements.
- Disclose paid promotion where the platform requires it, and use the platform's own toggle.
- No engagement bait, no link farms, no unrelated keywords.
- Do not add a link you have not opened.

## Output

```markdown
### Description for <video>
<opener and takeaway>

Chapters
0:00 <chapter>
...

Sources
- <label>: <url>

<footer>

Hashtags: <3 to 5>
Checks: timestamps verified against <player/edit>, links opened, claims match the video
```
