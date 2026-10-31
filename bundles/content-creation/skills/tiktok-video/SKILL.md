---
name: tiktok-video
description: Turn a long recording or an existing clip into a branded TikTok video. Select the moment, cut, lay out 9:16, burn in captions, place the logo, set the cover and prepare the export. Use when editing, captioning or reformatting video for TikTok, including from a YouTube Short.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# TikTok Video

TikTok rewards a clear first second and a complete small idea. Reuse the same real footage as the channel's Shorts, but do not upload a Short unchanged: re-check the crop, the caption position and the end of the clip for TikTok.

## Inputs

- The recording or the finished clip, plus a timed transcript.
- The channel's [video brand profile](../video-brand-profile/SKILL.md) (caption font, mark, colors, clip layout).
- For account-level questions, `tiktok-warmup` covers new-account behavior. This skill covers the video.

## Workflow

When [clip-cutter](../clip-cutter/SKILL.md) is installed, use it for the cut, vertical layout and burned-in captions (steps 3 to 5). If it is not installed, deliver the cut list and caption text and say the edit is a separate step.

1. **Choose the moment.** Same rubric as [youtube-shorts](../youtube-shorts/SKILL.md): hook speed, standalone clarity, a quotable line, visual proof, operator value.
2. **Open on the claim.** The first sentence names the subject and the tension. No intro, no logo sting, no "hey guys".
3. **Cut tight.** One point. Aim for 15 to 60 seconds. A longer video is allowed on the platform, but only keep length when the point needs it.
4. **Layout 1080 x 1920**, 30 fps, H.264 with AAC, no other app's watermark in the file.
5. **Captions.** Burn them in per the profile. TikTok also offers its own captions, but burned-in text keeps your font, timing and position on every surface.
6. **Keep the interface zones clear.** TikTok places the caption, creator name and sound line at the bottom and the action buttons at the right. There are no official pixel values. Third-party guides range from about 250 to 700 px at the bottom, 120 to 240 px at the right and 130 to 240 px at the top (1080 x 1920). Keep faces, product text and captions inside the central area, and keep the caption higher than you would for YouTube Shorts. Test on a real phone.
7. **Mark.** By default no persistent logo over footage. A short end frame with the channel name is enough. If the profile requires a corner mark, use the profile's corner and keep it clear of the interface zones.
8. **Cover.** Pick the frame that states the topic. If you add cover text, follow [tiktok-title](../tiktok-title/SKILL.md).
9. **Package.** Caption per [tiktok-description](../tiktok-description/SKILL.md). Publish only with the owner's go.

## Adapting a YouTube Short

| Change | Why |
|---|---|
| Move captions up | The TikTok bottom overlay is taller |
| Remove YouTube-specific words (subscribe, "Shorts", channel handle callouts) | They do not apply on TikTok |
| Re-cut the ending | End on the payoff, then a short frame; do not loop to the start with a cliffhanger you cannot deliver |
| Re-export without YouTube overlays | Do not burn another platform's UI or watermark into the file |
| Rewrite the caption | TikTok captions carry the hook and the search words |

## Check before delivering

- First second shows the subject or the tension, not a title card.
- Captions burned in, readable on a phone, inside the safe area.
- Every claim matches the recording; no invented numbers.
- Disclosure toggles are set where the platform requires them (paid partnership, realistic AI-generated content). Check the current TikTok policy.
- Record the profile version, fonts and export settings. Report technical checks separately from a watch-through.
