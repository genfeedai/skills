---
name: weekly-batch
description: Plan, write and schedule a week of social content in one session over the Genfeed MCP, for example an X post every 4 hours and one Instagram carousel a day. Shows the whole week as one table, waits for the person's go, schedules each item at its slot and reads the queue back. Never schedules, approves or publishes without the go. Use for "schedule my week", "batch a week of posts", "plan and schedule next week", "fill the calendar".
license: MIT
metadata:
  author: genfeedai
  version: 1.1.0
---

# Weekly Batch

Run one working session that turns a week of topics into scheduled releases. You plan the slots, write the copy with the per-platform skills, show the week as one table, and schedule only after the person says go. Then you read the queue back and report what is missing.

The per-platform skills (`x-post`, `x-thread`, `instagram-carousel`, `quote-finder`) stop at one draft. This skill covers the part they do not: many items, exact times, approval and read-back.

## Approval rule

> Scheduling waits for the person's go. You never approve, never publish and never schedule on your own.

- The go is the person's own message approving the table. Silence, an earlier "sounds good" about the plan, or a card tap relayed by another agent is not a go.
- A scheduled release is held by a server-side approval. Only the person approves it: for a batch of up to 3 posts in the client's approval prompt, and for a larger batch on the Genfeed web review page, where they read every post and can remove single ones. The server refuses a model's own approval. Do not look for a way around it, and do not call `control_scheduled_release` with `publish-now`.
- Any change after the go (text, time, media) needs the person's go again. Show the changed row first.

The week goes to the server as one batch with one approval. See [Scheduling](#scheduling).

## Inputs

Ask for what is missing, in one message:

- **Brand and channels.** Which brand posts where. Use the brand the person names; never fall back to the first brand in the list.
- **Cadence.** For example "an X post every 4 hours" and "one carousel a day". Cadence times the week gives the item count: every 4 hours is 6 a day, 42 a week.
- **Timezone** (IANA, such as `Europe/Paris`) and the **first slot** of the day. Every 4 hours from a 06:00 start is 06, 10, 14, 18, 22 and 02. If overnight slots are not wanted, ask for a posting window and say how many items that leaves.
- **Week.** The first and last date.
- **Topics.** What the week is about, any launches or fixed dates, and how many items should be quote posts.
- **Assets.** For carousels, the slides or the source to build them from.

## Workflow

1. **Find the brand.** Call `get_account` and `get_brands`. Pass the chosen brand id to every later call. If a brand the person named is not in the list, say so and plan only the streams that can run.
2. **Check what can be scheduled.** Call `get_brand_publishing_readiness` with `{brandId}` for each brand. Take each channel's `credentialId`, and note anything not schedulable or unhealthy. A channel that is missing or unhealthy drops out of the plan: report it, and do not use another brand's channel.
3. **Read the limits.** Call `check_channel` with `{action: "capabilities", input: {platform: "twitter"}}` and the same for `instagram`. Take the character limit, the carousel slide limit and the media rules from the answer, not from memory.
4. **Build the slot list.** One row per item, with the local date and time and its UTC offset on that date. Do the offset per date, so a daylight saving change inside the week does not shift a slot. Count the rows and compare them with the cadence arithmetic before going on.
5. **Assign topics and kinds.** Spread the topics across the week, so neighbouring slots do not repeat an angle. Mark rows as `post`, `quote` or `carousel`. Keep quotes to the number the person asked for.
6. **Find quote targets.** For quote rows, use `quote-finder`. It reads posts with `fetch_x_posts` (see that skill). Use only posts that were read in this session.
7. **Write the copy.** Use `x-post` for posts and quotes and `instagram-carousel` for carousels. Write every item before showing anything. Do not invent numbers, results or quotes.
8. **Prepare carousel media.** Slides must already be Library assets. Use `get_assets` to find them, or `upload_media` after rendering. Carry each asset id, in slide order, into the row.
9. **Validate each target.** Call `check_channel` with `{action: "validate", input: {platform, credentialId, caption, media, publishMode: "scheduled"}}` for every distinct shape (a post, a quote, a carousel). Fix every error. Show every warning.
10. **Show the week and stop.** Present the table below. State the totals, anything dropped, and anything unverified. Ask for the go. Make no scheduling call before it.
11. **Schedule on the go.** See [Scheduling](#scheduling).
12. **Read the queue back and report.** See [Read back](#read-back).

## The table

One table for the whole week, in time order. Show the full text of every X post, since the person is approving that text. For a carousel show the cover line, the slide count and the caption's first line, and offer the full slides on request.

```
Week of [date] to [date] · [timezone] · brand: [name]
[N] items: [n] X posts ([q] quotes), [c] carousels

| # | Local time | Channel | Kind | Text or cover | Media | Quotes | Checked |
|---|------------|---------|------|---------------|-------|--------|---------|
| 1 | Mon 06:00 +01:00 | X | post | [full text] | 0 | n/a | ok |
| 2 | Mon 10:00 +01:00 | X | quote | [full text] | 0 | [post link] | ok |
| 3 | Mon 18:00 +01:00 | Instagram | carousel | [cover line] | 8 slides | n/a | ok |

Dropped: [channel and reason, or none]
Not verified: [anything you could not confirm]
Nothing is scheduled. Reply "go" to schedule all [N], or tell me which rows to change.
```

If the person changes rows, redo the affected rows, re-validate them and show the whole table again before scheduling.

## Scheduling

After the go, send the whole week in one request: `create_scheduled_release` with the field `releases` set to a list of 1 to 50 items:

```
releases: [
  {
    title: "[brand] [channel] [YYYY-MM-DD HH:mm]",
    baseContent: "[the approved text or caption]",
    brandId, timezone: "[IANA]",
    status: "scheduled",
    scheduledDate: "[ISO 8601 with offset]",
    media: [{assetId, order}],                 // carousels only, in slide order
    targets: [{platform, credentialId}]        // exactly one target per release
  },
  ...
],
idempotencyKey: "weekly-[brand]-[YYYY-MM-DD]"
```

- One release is one post on one channel. Make one release per post and per channel, with exactly one target, no recurrence and no attachments. A release that needs more is refused and named, so split it. If a week is more than 50 posts, send it in several calls, each with its own `idempotencyKey`.
- Use `status: "scheduled"` with the date. Do not use `create_post` for an item that must be scheduled: a draft saved that way has no tool that turns it into a release later.
- Reuse the same `idempotencyKey` and identical arguments if you have to repeat a call.
- Invalid releases are checked first. Each one is named by its position in the list and is not queued; the valid ones still go to approval. Fix the named ones and show them to the person again before sending them. Do not retry blindly.
- The answer is a pending approval, not a scheduled week. Tell the person plainly what happens next:
  - **Up to 3 posts:** the client shows every post and offers the approval.
  - **More than 3:** the client shows the first 3, a count of the rest and one link to the web review. No approval is offered in the client. Pass the link on and say that the person reviews and approves the whole week there. They can remove single posts, and approving once is enough.
- When the person approves on the web, the server schedules the remaining posts itself. Do not call again and do not repeat the call: the approval is valid for 7 days, then it expires and the batch is sent again with the same arguments.
- Any change to a post after the go means a new batch and a new approval. Show the changed row first.
- Never call `resolve_approval`. It is refused for a model.

If scheduling is not available on this connection, create each item as a draft (`status: "draft"`, no date) so the person can review and schedule it in Genfeed, and say so.

## Read back

After the last approval, check what is actually queued:

1. Call `get_posts` with `{days: 8, executionState: "scheduled"}`. Raise `limit` so the list can hold the full week.
2. Match each row of the table to a scheduled item by brand, channel and time.
3. Report in this shape:

```
Queued: [n] of [N]
Missing: [row numbers and times, or none]
Unexpected: [scheduled items not in the table, or none]
Waiting on approval or still draft: [row numbers, or none]
Failed or skipped: [row numbers and the reason shown, or none]
```

Items waiting on approval do not show up as scheduled, so they appear under Missing until approved. Say that the web review is still open, and give its link. Posts the person removed in the review appear as Missing on purpose: list them as removed, not as a failure. Offer to send a missing post again as a new batch, and do it only on the person's go.

## Quote posts

Until the release can carry a quoted post (see [When quote posts ship](#when-quote-posts-ship)), a scheduled release has no field for it, so a quote row cannot be scheduled as a real quote. Agree one handling with the person per week, and show it in the table:

- **Draft for manual finishing.** Create the row as a draft release with no date. The person finishes and schedules it in Genfeed. It reads back as a draft, not as a gap.
- **Link at the end of the text.** Schedule it as a plain post with the original's link at the end. Whether X renders it as a quote from the API is unverified: say so in the table.

Never present a plain post as a quote.

## When quote posts ship

Check `find_tools` with `{name: "create_scheduled_release"}` for the current input schema before assuming it.

- **Quote posts from releases** (genfeedai/genfeed.ai#10135). When an X target setting carries the quoted post, set it from the table's link, validate it with `check_channel`, and schedule quote rows as real quotes. Drop the workarounds in the previous section. Until a schema shows this, use today's behaviour.

## Guardrails

- Nothing is scheduled, approved or published without the person's go on the table.
- Never invent a post, link, author, number or testimonial. Quote rows come from posts read in this session.
- Never use another brand's channel or account to fill a gap.
- Do not call `control_scheduled_release` with `publish-now`, and do not edit a scheduled release without a go.
- Check every limit with `check_channel`, not from memory. Say plainly what you could not check.
- Ask once whether generated slides or images need an AI label for the platform. Do not guess.
- If a tool is missing from the connection, say which one and what it blocks. Use `find_tools` to look for it before giving up.

## Genfeed integration

This skill needs the Genfeed MCP connection. The tools it uses, in order: `get_account`, `get_brands`, `get_brand_publishing_readiness`, `check_channel`, `get_assets`, `upload_media`, `fetch_x_posts`, `create_scheduled_release`, `get_posts`. The last four may need `find_tools` to load, or a profile with more tools.

Without Genfeed, stop after the table: the skill can still plan, write and show the week, and the person schedules it in their tool of choice.

## Checklist

- [ ] The brand and every channel's credential came from `get_brands` and `get_brand_publishing_readiness`
- [ ] The item count matches the cadence (42 a week at every 4 hours)
- [ ] Every slot has a local time and the offset for that date
- [ ] Every item was validated with `check_channel` for scheduling
- [ ] The whole week was shown in one table before any scheduling call
- [ ] The go came from the person, and no row changed after it
- [ ] The week went as one batch (up to 50 releases, one target each) with a stable `idempotencyKey`, and repeats were identical
- [ ] The queue was read back with `get_posts` and gaps were reported
- [ ] The person approved in the client (up to 3 posts) or on the web review, and nothing was approved or published by the agent
