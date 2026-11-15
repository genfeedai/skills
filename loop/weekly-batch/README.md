# Weekly Batch

<!-- generated:start (bun run skills:generate; edit SKILL.md, not this block) -->
Plan, write and schedule a week of social content over the Genfeed MCP: one table for approval, one batch with one approval after the go, then a read back of the queue.

## Installation

```bash
bunx skills add genfeedai/skills --skill weekly-batch
```
<!-- generated:end -->

## Usage

```
"Schedule my week: an X post every 4 hours, and a carousel a day on Instagram"
"Plan next week for the brand, Monday to Sunday, Paris time, 3 quote posts"
"Fill the calendar for the week, show me the table first"
```

## What It Does

- Finds the brand and its schedulable channels, and reads the platform limits
- Builds the slot list with the UTC offset on each date
- Writes with `x-post`, `instagram-carousel` and `quote-finder`
- Shows every item in one table and waits for the person's go
- Sends the whole week in one `create_scheduled_release` batch (up to 50 posts, one channel each); up to 3 posts are approved in the client, more on the Genfeed web review page
- Reads the queue back with `get_posts` and reports missing, unexpected and unapproved items
- Never approves, publishes or schedules without the go

## License

MIT
