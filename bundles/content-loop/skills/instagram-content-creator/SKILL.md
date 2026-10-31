---
name: instagram-content-creator
description: Router for Instagram content. Picks the right product skill (instagram-post, instagram-carousel, instagram-reel, instagram-story) and carries the essentials so it works on its own. Triggers on "write an instagram caption", "create instagram content", "carousel outline", "reel script", "story sequence", "hashtag strategy".
license: MIT
metadata:
  author: genfeedai
  version: 2.0.0
---

# Instagram Content Creator (router)

Instagram content now has one skill per product. This skill keeps the old name so existing installs and links keep working: it decides which product the request is, points to that skill, and carries enough of the essentials to produce a good draft even when the product skills are not installed.

## Route the request

| The user wants | Skill | Install |
|----------------|-------|---------|
| A feed caption, hashtags, alt text for a single image | [instagram-post](../instagram-post/SKILL.md) | `bunx skills add genfeedai/skills --skill instagram-post` |
| A multi-slide swipeable post | [instagram-carousel](../instagram-carousel/SKILL.md) | `bunx skills add genfeedai/skills --skill instagram-carousel` |
| A Reel script, hook or short vertical video | [instagram-reel](../instagram-reel/SKILL.md) | `bunx skills add genfeedai/skills --skill instagram-reel` |
| A Story sequence with stickers | [instagram-story](../instagram-story/SKILL.md) | `bunx skills add genfeedai/skills --skill instagram-story` |

How to choose:

1. One image plus a caption: **instagram-post**.
2. Teaching or a list that works as slides: **instagram-carousel**.
3. Discovery, motion, a demo or a talking point on video: **instagram-reel**.
4. A conversation with existing followers, a poll, a launch countdown: **instagram-story**.
5. A "hashtag strategy" request alone goes to **instagram-post**.
6. If unclear, default to **instagram-post** and offer the others. A launch can use all four.

Open the product skill and follow it. If it is not installed, use the essentials below and tell the user the full skill is available.

## Essentials (fallback)

### Any Instagram content

- Visual first, copy second. Decide what the visual says before writing.
- Only the first ~125 characters of a caption show before "more": the hook lives there.
- Saves and shares are the content to write for: tips, checklists, frameworks.
- Real facts only. Alt text on every image. Reply to comments in the first hour.

### Post

Hook under 125 characters, 2 to 5 short paragraphs, one CTA, a relevant hashtag set (3 to 10 is a safe default; test on the account).

### Carousel

Cover (5 to 8 word headline), problem slide, one idea per slide of about 30 words or fewer, recap, CTA slide. Same layout throughout. Render with [carousel-renderer](../carousel-renderer/SKILL.md) if it is installed.

### Reel

```
HOOK (0-3s)  visual + spoken line + text overlay
CONTENT      fast cuts, one point per scene, text carries the message
CTA (last 3s)
```

Make it work with the sound off. Caption complements, not repeats. Check music rights for business accounts.

### Story

5 to 7 frames: hook, context, value, interactive sticker, deeper dive, summary, CTA. Keep text in the safe area. Answer every reply.

## Output

Return copy ready to paste. For options, label A, B, C and say in one line what differs.

## Genfeed integration

If Genfeed tools are available, `create_post` saves a draft with `platforms: ["instagram"]` and `mediaUrls`; it does not publish. Publishing goes through [social-poster](../social-poster/SKILL.md), only on explicit confirmation. The skill works fully without Genfeed.
