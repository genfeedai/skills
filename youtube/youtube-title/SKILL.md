---
name: youtube-title
description: Write truthful, click-worthy YouTube titles for livestreams, recaps, cutdowns and Shorts, as a pair with the thumbnail. Use when naming a video, a Short or a livestream, or testing title variants.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# YouTube Title

A title and a thumbnail are one promise told twice. The title carries the specific words; the thumbnail carries the picture. Both must be true of the video.

## Inputs

- The real asset: the final edit for a recap or Short, the topic board for an upcoming live, the transcript for a finished stream.
- The channel's video brand profile (`video-brand-profile`) for name spelling and length rules.
- The thumbnail brief, if one exists ([youtube-thumbnail](../youtube-thumbnail/SKILL.md)).

## Workflow

1. State the video's single answer in one sentence from the transcript or edit. If you cannot, the video is not ready to title.
2. Pull the concrete nouns: the tool, the company, the number, the failure. Prefer ones the speaker actually said.
3. Write 5 candidates across different angles. Keep 3 that you would stand behind.
4. Pair each with the thumbnail text, so the two do not repeat each other word for word.
5. Check length, spelling, truth and the first words.

## Limits and length

| Format | Target | Hard limit |
|---|---|---|
| Short | 35 to 60 characters | 100 |
| Cutdown or recap | 45 to 75 characters | 100 |
| Livestream | 50 to 80 characters | 100 |

Put the subject in the first words, because surfaces cut long titles. Spell the channel name exactly as the profile does and do not spend title characters on it unless the profile says so.

## Angles

| Angle | Use when | Pattern |
|---|---|---|
| Outcome | Something works or fails on screen | `<Tool> <did the observable thing> in <small unit>` |
| Conflict | Two options or two opinions | `<A> vs <B>: <the deciding fact>` |
| Cost | Money or limits changed the decision | `<Number> for <result>: <verdict>` |
| Warning | A risk operators should stop ignoring | `Stop <doing X> before <consequence>` |
| Firsthand | The hosts tried it | `We tried <thing>. <what happened>` |

Title the observable result, not the activity: "Claude Built a CAD App in One Prompt", not "Testing Claude".

## Rules

- Truthful. The title must not promise more than the video shows or the speaker said.
- One conflict. Do not list every vendor or model in one title.
- No engagement bait ("agree?", "comment if"), no fake countdowns, no unsupported superlatives. Use "insane" or "game-changing" only if the video earns it with a receipt.
- No colon or punctuation the profile bans from the name, and exact spelling of product names.
- Do not repeat last week's title pattern for a different claim.
- Do not call a variant a winner. If testing, hold the thumbnail fixed when testing the title, or label each title and thumbnail pair.

## Output

```markdown
### Title candidates for <video>
1. <title> (<n> chars): angle, why it is true, thumbnail pairing
2. ...
3. ...
Default: <1, 2 or 3> and why
Risks: wording to confirm against the recording
```
