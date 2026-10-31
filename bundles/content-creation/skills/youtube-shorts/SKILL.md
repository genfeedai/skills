---
name: youtube-shorts
description: Turn a long recording or livestream into branded YouTube Shorts. Pick the clips, cut them, caption them, place the logo, make the cover and write the title and caption. Use when selecting or editing Shorts, cutdowns, clip captions, Shorts covers or repackaging a stream for discovery.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# YouTube Shorts

Make Shorts from real footage of a longer video. A Short is a complete, narrow point that works cold in a feed. It is not a trailer or a summary of the episode.

## Inputs

- The recording and a transcript with timestamps (a clean transcript for judging, the timed one for cutting).
- The channel's [video brand profile](../video-brand-profile/SKILL.md). Without it, ask for the caption font, the mark placement and the thumbnail rule before editing.
- Optional: the episode's topic notes, recent clip performance for the same channel.

## Workflow

1. **Find 6 to 12 candidates**, then rank down to 3 to 5 to publish first.
2. **Cut** each one to a single point with a start on the claim.
3. **Lay out** the 9:16 frame.
4. **Caption** from the final timeline.
5. **Add the end card** and, only if the profile asks, the corner mark.
6. **Make the cover.** See [youtube-thumbnail](../youtube-thumbnail/SKILL.md), Short mode.
7. **Package** the title, caption and hashtags. See [youtube-title](../youtube-title/SKILL.md) and [youtube-description](../youtube-description/SKILL.md).
8. **Check** against the list at the end, then hand off with the record.

## 1. Choosing clips

Score each candidate 1 to 5 on:

- **Hook speed.** The subject and the tension are clear by second 2.
- **Standalone clarity.** It makes sense without the episode.
- **Quotable line.** One sentence a viewer can repeat or that can become the title.
- **Visual proof.** Something on screen: a demo, a number, a failure, a clear reaction.
- **Operator value.** The viewer leaves with a decision, a warning or a rule.

Prefer a named tool or company in the first sentence, a visible tension (versus, cost, failure, risk, proof) and one concrete noun (a bill, a repo, a token count).

Downrank:

- Clips that start with greetings, setup or "we were talking about".
- Clips that need more than 5 seconds before the topic is clear.
- Inside jokes, news summaries without a take, generic lines like "AI is changing everything".
- Static talking with no strong line.
- Anything that ends by asking viewers to agree or comment.

Do not invent quotes, timestamps or numbers. Mark an estimated timestamp `approx` and check it against the recording. Keep a qualification or an opposing view when removing it would change the conclusion.

## 2. Cutting

When [clip-cutter](../clip-cutter/SKILL.md) is installed, it can run the cut, caption and burn-in steps locally from the clip list and the brand profile. If it is not installed, give the cut list (start, end, caption text) and say the edit is a separate step.

- Start on the sentence that carries the claim. Cut breaths, restarts and "so".
- One point per Short. Typical length is 20 to 60 seconds; YouTube now allows square or vertical Shorts up to 3 minutes, but length is not a goal.
- Keep real audio. Normalize it (for example integrated loudness -16 LUFS, true peak -1.5 dB) and use a few milliseconds of fade at both ends so cuts do not click.
- A cut must not make a speaker say something stronger than they said.

## 3. Layout

- Export 1080 x 1920 at 30 fps (a 2160 x 3840 master is fine), H.264, AAC 48 kHz.
- Use the profile's clip layout. For two hosts on one source, stack two crops so both faces stay large.
- Keep faces, product text and the caption inside the central area. No platform publishes official safe-zone pixels for Shorts. Third-party guides disagree on the bottom margin (about 250 to 670 px at 1080 x 1920). A working rule is to keep everything inside the central 900 x 1400 px and keep the caption bottom edge above about 78% of the height. Check one real Short on a phone before you lock the numbers. The Ship Sh!t Show Shorts, as built, put the caption at y 1490 of 1920 (77.6%, 52 px Arial Bold, 3 words per phrase) and the white mark upper right at about 72 px; see the [example profile](../video-brand-profile/references/ship-shit-show.profile.json).

## 4. Captions

Follow the profile. Defaults when it is silent:

- Burn them in. A soft subtitle track is not shown on every surface and a viewer cannot rely on it.
- Group 3 to 7 words, at most 2 lines, sentence case, spoken punctuation kept.
- A solid dark backing behind white text. One bold, broad family.
- Do not color a word unless the color carries meaning. No default karaoke effect.
- Time them to the final edit, not to the full-stream timestamps.
- Read every caption against the audio for names, numbers and qualifiers.

## 5. Mark and end card

- Brand art stays separate from factual footage. By default put no persistent logo on the footage.
- Close with a short end card (about 2 to 3 seconds): channel name, one line that pays off the clip, and where the full episode is.
- If the profile asks for an in-video mark, put it in the profile's corner, inside the safe area, at the profile's size and color.

## 6. Cover

Shorts do not have native thumbnail A/B testing. YouTube announced custom Shorts thumbnails in July 2026 for Partner Program channels (reported by trade press; check Studio on your channel). Whether the Data API accepts `thumbnails.set` for a Short is not documented, so treat the API as best effort and keep Studio as the fallback. If custom covers are unavailable, choose the best frame and make sure it reads at small size.

## 7. Packaging

- Title: 35 to 60 characters, subject first, the conflict or the result in plain words. Hard limit 100.
- First sentence of the caption repeats the hook in different words.
- 3 to 5 specific hashtags. Do not put every vendor in the title; pick the conflict.
- Avoid "insane" and "game-changing" unless the clip shows the receipt.

## Output per clip

```markdown
### Clip: <slug>
- Source range: 00:12:34-00:13:08 (verified | approx)
- Type: model fight | build proof | operator warning | cost reveal | hot take | failure autopsy
- Hook text: 3 to 7 words
- Title:
- Caption:
- Hashtags:
- Cover: frame time or brief
- Risk: context needed | fact to check | weak audio
- Files: video, captions, cover (paths)
- Profile version and fonts used:
```

## Check before delivering

- The first 2 seconds name the subject.
- Every spoken claim matches the recording.
- Captions are burned in, readable on a phone, and inside the safe area.
- The end card and the cover use the profile's mark, color and font.
- Report technical checks (dimensions, loudness, duration) separately from "someone watched it".
- Nothing is uploaded or scheduled without the owner's go.
