---
name: x-content-creator
description: Router for X/Twitter content. Picks the right product skill (x-post, x-thread, x-article) and carries the essentials so it works on its own. Triggers on "write a tweet", "create a thread", "draft a tweet", "compose a tweet", "quote tweet", "tweet about", "X article".
license: MIT
metadata:
  author: genfeedai
  version: 2.0.0
---

# X Content Creator (router)

X content now has one skill per product. This skill keeps the old name so existing installs and links keep working: it decides which product the request is, points to that skill, and carries enough of the essentials to produce a good draft even when the product skills are not installed.

## Route the request

| The user wants | Skill | Install |
|----------------|-------|---------|
| One post, a quote post or a reply | [x-post](../x-post/SKILL.md) | `bunx skills add genfeedai/skills --skill x-post` |
| A sequence of 2 to 15 connected posts | [x-thread](../x-thread/SKILL.md) | `bunx skills add genfeedai/skills --skill x-thread` |
| A long-form, titled X Article plus its promo post | [x-article](../x-article/SKILL.md) | `bunx skills add genfeedai/skills --skill x-article` |

How to choose:

1. If the idea fits one claim, use **x-post**.
2. If it has steps, a story or a list that needs room, use **x-thread**.
3. If it needs headings, evidence and a reference-grade layout, use **x-article**.
4. If unclear, ask one question or default to **x-post** and offer the thread.
5. If the user wants several (for example an article plus a promo thread), run them in this order: article, promo post, thread.

Open the product skill and follow it. If it is not installed, use the essentials below and tell the user the full skill is available.

## Essentials (fallback)

### Any X content

- Hook in the first 5 to 10 words. Value before vanity. One idea at a time.
- Use only real facts, numbers and quotes. Never invent results.
- No external link in the main post (put it in a reply). At most 2 hashtags.
- Reply to comments in the first hour.

### Post

```
[Hook]
[Core insight, 1-2 sentences]
[CTA or punchline, optional]
```

Base limit is 280 characters; check the composer for the account's actual limit. For quote posts, always add value and credit the author. For replies, add data, experience, a smart question or a resource.

### Thread

```
1/ Hook (the promise)
2/ Context
3..N-2/ One idea per post, each standalone
N-1/ Recap
N/ CTA
```

Number the points, vary length, add proof, save the best point for N-2.

### Article

Title states the claim. Open with the reader's problem. Headings are claims. One CTA. Write a promo post that works without the link. Check current X Article eligibility and limits before promising a layout; they are not verified here.

## Output

Return copy ready to paste. For options, label A, B, C and say in one line what differs.

## Genfeed integration

If Genfeed tools are available, `create_post` saves a draft with `platforms: ["twitter"]`; it does not publish. Publishing goes through [social-poster](../social-poster/SKILL.md), only on explicit confirmation. The skill works fully without Genfeed.
