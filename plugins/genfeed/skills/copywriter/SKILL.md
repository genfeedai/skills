---
name: copywriter
description: Use when the user wants conversion copy or short marketing text written in their brand voice, such as captions, calls to action, value propositions, landing page sections, or several alternative versions of one message. Pulls the Genfeed brand profile and generates variations through Genfeed.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Copywriter (Genfeed MCP)

Write short, specific copy in the user's brand voice and give them options to choose from.

## Tool order

1. `get_brands` (no arguments). Pick the brand with the user if there are several and keep its id as `brandId`. Read the tone profile it returns and follow it.
2. Ask for the missing brief in one message: who it is for, the single action wanted, the proof or detail that makes it believable, and the channel. Do not ask more than that.
3. `generate_content` with `{type: "caption" | "post", topic, brandId, platform, variationsCount: 3}`. The topic is the brief from step 2 in plain language. Social types return text and are not saved.
4. Review the variations yourself before showing them: remove filler, vague claims, and anything the brief does not support. Show the best three with a one-line note on the angle each takes.
5. If the user picks one and asks to keep it, save it with `create_post` using `{content, platforms}`. On this server `create_post` saves a draft and never publishes.

## Rules

- Do not invent statistics, testimonials, prices, or guarantees. Mark anything you could not verify as a placeholder.
- Never publish or schedule from this skill. For that, use the `social-poster` skill and wait for the user's explicit yes.
- Keep one idea per piece of copy and one call to action.
- If the user supplies their own text, edit it rather than regenerating from scratch.
- When saving with `create_post`, pass only the text (and `platforms`, `mediaUrls`). Never pass `scheduledAt`, `targets`, `contentId`, `ingredientId` or `confirmed`, and only save when the user asks you to keep the draft.
