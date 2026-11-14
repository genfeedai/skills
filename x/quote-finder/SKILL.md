---
name: quote-finder
description: Find fresh public X (Twitter) posts worth quote-posting for a brand, from a list of accounts, topics or post links. Returns a short ranked list with the link, why it fits and a suggested angle. Proposes only; never posts. Use for "find posts to quote", "what should we quote today", "quote post ideas". To write the final quote use x-post.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# Quote Finder

Find a few recent public posts a brand can add something real to with a quote post. This skill only proposes. You pick, you approve, and nothing is published or scheduled. Write the final wording with [x-post](../x-post/SKILL.md).

## Inputs

- The brand: topics, voice, audience and what it must never say. Use what the user gives, or Genfeed's `get_brand_context` when connected.
- The sources: accounts, topics or links to recent posts.
- Freshness window. Default 48 hours.
- Max candidates. Default 5.

## Workflow

1. **Get the brand context.** If it is thin, ask one question about topics and voice before searching.
2. **Gather posts.** Use the read tools in this session, in this order:
   - Links the user pasted: read each one.
   - Genfeed `get_trends` for topic signals, when connected. It returns trends, not a feed of an account's posts, so use it to pick topics and ask for links to the posts themselves.
   - Genfeed `fetch_x_posts`, when connected: `{postIdOrUrl}` reads one post with its text and stats, and `{query, brandId, limit, sortOrder}` searches recent posts through the brand's connected X account. Pass exactly one of `postIdOrUrl` or `query`. It costs 1 credit per call, so say so before a long run of searches. It is in the `analytics` toolset: if it is not in the tool list, call `find_tools` with `{name: "fetch_x_posts"}`, then reconnect with `?toolsets=analytics` added to the MCP URL, or with `?profile=studio`.
   - Any other tool in the session that reads public X posts.
3. **Say so if you cannot read posts.** If no tool can read fresh posts for a source, tell the user plainly and ask them to paste links. Never invent a post, an author, a link or an age.
4. **Drop** posts outside the window, replies, private or protected accounts, and anything you cannot open.
5. **Rank** with the criteria below and keep the top candidates.
6. **Return** the list in the output format and stop. The user chooses.

## Ranking criteria

| Criterion | Prefer | Skip |
|-----------|--------|------|
| Freshness | Inside the window, still gaining replies | Stale or already saturated |
| Brand fit | Topic and audience match the brand | Off-topic, or needs a stance the brand does not hold |
| Room to add | A real point: a fact, an example, a counterpoint, a how-to | Pure agreement ("this") |
| Author reach | Larger than the brand, or a peer in the same niche | Tiny accounts, or a far larger account where a quote buries |
| Tone | Constructive, curious, informative | Pile-ons, outrage, negative dunking, personal disputes |

When two posts tie, prefer the one where the brand's quote would stand on its own without the original.

## Output format

```
Ranked quote candidates (window: 48h, brand: [name])

1. [Post link]
   Author: @handle (reach: [followers if known])
   Age: [e.g. 6h]
   Why it fits: [one or two sentences tied to the brand's topics and voice]
   Angle: [one line: what the brand adds]
   Draft opening line: [one line in the brand voice]
```

Then add:

```
Skipped: [count and short reasons]
Not verified: [anything you could not read or confirm, such as author reach]
Next: pick a number and I will hand it to x-post for the final wording. Nothing has been posted.
```

If fewer posts qualify than the max, return fewer. Do not pad the list.

## Guardrails

- Never invent a post, link, author, metric or quote. Every item comes from a post you actually read.
- Never publish, schedule or save a draft on your own. The user approves each post.
- Quote only public posts. Skip protected accounts and screenshots of private messages.
- Do not suggest quoting a post just to attack a person. No harassment, no pile-ons.
- Draft opening lines are suggestions, not final copy. Hand the chosen one to [x-post](../x-post/SKILL.md).

## Genfeed integration

If Genfeed tools are available:

- `get_brand_context` supplies topics and voice.
- `get_trends` with `{category, timeframe}` surfaces topics. It does not list an account's posts. If it is not in the tool list, call `find_tools` with `{query: "trends"}` and describe the limitation if it is missing.
- `fetch_x_posts` reads a post or searches recent posts (see Workflow). Search needs the brand's X account to be connected and able to search; if the answer says it cannot, ask the user for links instead.
- `create_post` saves the final quote as a draft only after the user picks a candidate and approves the wording. It does not publish, and a draft saved this way cannot be scheduled over MCP later. To schedule a week of posts, use `weekly-batch`.

The skill works without Genfeed when the user pastes links.

## Checklist

- [ ] Every candidate has a real link that was read in this session
- [ ] Each is inside the freshness window
- [ ] Each has a fit reason, an angle and a draft opening line
- [ ] No pile-ons or negative dunking
- [ ] Nothing was posted, scheduled or saved
- [ ] Anything unread or unverified is stated
