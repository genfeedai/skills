# Weekly Batch

Plan, write and schedule a week of social content in one session over the Genfeed MCP: for example an X post every 4 hours and one Instagram carousel a day. The whole week is shown as one table, and nothing is scheduled until the person says go.

## Installation

```bash
bunx skills add genfeedai/skills --skill weekly-batch
```

Needs the Genfeed MCP connection. See [Genfeed integration](../../README.md#genfeed-integration).

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
- Schedules each item with `create_scheduled_release`, one day at a time
- Reads the queue back with `get_posts` and reports missing, unexpected and unapproved items
- Never approves, publishes or schedules without the go

## License

MIT
