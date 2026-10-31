---
name: tiktok-description
description: Write the TikTok caption (description) with a hook line, one supporting fact, hashtags, mentions and disclosure, within the 2,200-character limit. Use when writing or editing a TikTok caption or description.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# TikTok Description

The caption is short copy that helps the video get found and understood. It does not repeat the transcript.

## Limit

TikTok's Content Posting API reference sets the video caption (sent as `title`) at 2,200 UTF-16 runes. Treat 2,200 as the ceiling for the whole string including hashtags and mentions. The app has changed its own limit before, so check the current one in the app before relying on a longer caption. Most good captions use under 300 characters.

## Inputs

- The clip and its transcript.
- The [tiktok-title](../tiktok-title/SKILL.md) layer, so the first line agrees with the hook and the cover.
- The channel's video brand profile (`video-brand-profile`) for spelling, tone and footer rules.

## Structure

1. **First line.** The search-friendly sentence from the title layer. It is what feeds show before "more".
2. **One supporting fact.** The detail that lets the clip stand alone: the number, the tool version, the condition.
3. **Pointer, optional.** Where the full episode is, in words. Links in captions are often not tappable, so name the destination (for example the channel name) instead of pasting a long URL.
4. **Hashtags.** 3 to 5, specific to the topic and tool (`#ClaudeCode`, `#AICoding`), not generic reach tags. Put them at the end.
5. **Mentions.** Only people or accounts that appear in the clip or that you have agreed to tag.

## Rules

- Say what the clip says. No invented results, no stronger claims, no fake urgency.
- No bait or comment begging.
- Spell products and handles exactly.
- Use the platform's own toggles for paid partnerships and for realistic AI-generated content. Check the current TikTok policy; a caption note is not a substitute.
- Do not paste another platform's footer or call to subscribe.
- Match the language of the clip.

## Output

```markdown
### Caption for <clip>
<first line>
<supporting fact>
<pointer, if any>
#tag1 #tag2 #tag3

Length: <n> characters (limit 2,200)
Disclosures needed: none | paid partnership | AI-generated realistic content
Check: claims match the recording, handles exact, hashtags specific
```
