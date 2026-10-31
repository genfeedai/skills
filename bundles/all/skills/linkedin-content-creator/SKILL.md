---
name: linkedin-content-creator
description: Router for LinkedIn content. Picks the right product skill (linkedin-post, linkedin-article, linkedin-carousel) and carries the essentials so it works on its own. Triggers on "write a linkedin post", "linkedin article", "linkedin carousel", "linkedin newsletter", "thought leadership", "professional post".
license: MIT
metadata:
  author: genfeedai
  version: 2.0.0
---

# LinkedIn Content Creator (router)

LinkedIn content now has one skill per product. This skill keeps the old name so existing installs and links keep working: it decides which product the request is, points to that skill, and carries enough of the essentials to produce a good draft even when the product skills are not installed.

## Route the request

| The user wants | Skill | Install |
|----------------|-------|---------|
| A text post (story, insight, contrarian, list, win, objection) | [linkedin-post](../linkedin-post/SKILL.md) | `bunx skills add genfeedai/skills --skill linkedin-post` |
| A long-form article or a newsletter edition | [linkedin-article](../linkedin-article/SKILL.md) | `bunx skills add genfeedai/skills --skill linkedin-article` |
| A swipeable PDF document post (slides) | [linkedin-carousel](../linkedin-carousel/SKILL.md) | `bunx skills add genfeedai/skills --skill linkedin-carousel` |

How to choose:

1. One idea or story in the feed: **linkedin-post**.
2. A piece with sections, evidence and search value, or a newsletter issue: **linkedin-article**.
3. A framework, steps or comparison that works as slides: **linkedin-carousel**.
4. If unclear, default to **linkedin-post** and offer the other two.
5. For several, run article first, then the promo post, then the carousel.

Open the product skill and follow it. If it is not installed, use the essentials below and tell the user the full skill is available.

## Essentials (fallback)

### Any LinkedIn content

- Professional, not corporate. Specific beats vague. Real facts, numbers and names only.
- Hook in the first two lines. Avoid "I'm excited to share" and "Thoughts?".
- No external link in the body; put it in the first comment.
- Reply to comments in the first hour.

### Post

Short paragraphs, whitespace, 1,000 to 1,300 characters for story and insight posts. Shape: hook, setup, conflict, resolution, lesson, a question that invites a real answer. 3 to 5 hashtags at most.

### Article

```
Title (under ~70 characters)
Introduction 150-200 words
3 sections of 300-400 words, headings that state points
Action steps 200-300 words
Conclusion 100-150 words with one CTA
```

Plus a native feed post to promote it. Newsletter editions add quick hits and a reader question.

### Carousel

Cover with a promise and swipe cue, a problem slide, one insight per slide, a recap, a CTA slide. Consistent branding, at most 3 font sizes, large text. Render with [carousel-renderer](../carousel-renderer/SKILL.md) if it is installed.

## Output

Return copy ready to paste. For options, label A, B, C and say in one line what differs.

## Genfeed integration

If Genfeed tools are available, `create_post` saves a draft with `platforms: ["linkedin"]`; it does not publish. Publishing goes through [social-poster](../social-poster/SKILL.md), only on explicit confirmation. The skill works fully without Genfeed.
