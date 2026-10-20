# Genfeed plugin: listing copy

Paste-ready copy for both directory submissions. Source of truth for the manifest values is
`plugin.json` and `.claude-plugin/plugin.json`; if they change, update this file. Submission
itself and test credentials are done by a person in each portal.

## 1. OpenAI plugin submission

Package: this folder (`plugins/genfeed/`). Manifest: `plugin.json`. MCP: `mcp.json`.

| Field | Value |
|-------|-------|
| Name (`displayName`, max 30) | Genfeed |
| Subtitle (`shortDescription`, max 30) | Create and schedule content (27 chars) |
| Developer (`developerName`, max 80) | Genfeed |
| Category | Productivity (the docs show only this example; pick the closest option in the dashboard, for example a marketing or content option if offered) |
| Capabilities (max 20, 120 chars each) | Read, Write, Content planning, Social post drafting, Image and video generation, Post scheduling with confirmation |
| Website | https://genfeed.ai |
| Privacy policy | https://genfeed.ai/privacy |
| Terms of service | https://genfeed.ai/terms |
| Support | https://genfeed.ai/contact |
| MCP server | `https://mcp.genfeed.ai/mcp?profile=full` (streamable HTTP, OAuth; full toolset) |
| Brand colour | #0A0A0A (light) and `#FFFFFF` (dark) |
| Logo | `assets/logo.svg` (mark in `#0A0A0A`, for light backgrounds) |
| Logo, dark | `assets/logo-dark.svg` (mark in `#FFFFFF`, for dark backgrounds) |
| Composer icon | `assets/icon-192.png` (192x192; also `assets/icon-512.png`) |

### Long description (932 of 4000 chars)

Genfeed connects your brand to an AI content workflow. Ask for a content plan, post and thread drafts for X, LinkedIn, Instagram and YouTube, newsletter editions, or images and video, and the assistant uses your Genfeed brand profile for tone and voice. It can read your content calendar, repurpose an existing post for another channel, check what is trending, and generate media after showing the credit cost. Scheduling goes through a validation step against the channel's rules, then a summary of the exact text, account and time. Nothing is scheduled or published until you explicitly confirm. Requires a Genfeed account; image, video and some text generation spend Genfeed credits. The plugin does not store your content itself and does not post on its own. Limits: it works only with the brands and connected channels in your Genfeed workspace, cannot guarantee reach or performance, and does not edit content outside Genfeed.

### Default prompts (max 3, max 128 chars each)

1. Plan next week's content for my brand and show gaps in my calendar (66 chars)
2. Write three X post options about our launch in my brand voice (61 chars)
3. Make an Instagram image for this caption, but show the cost first (65 chars)

### Screenshots

TODO (needs the live product). Add 3 to 5 square PNG, JPEG, WebP or SVG files (min 48x48, max
5 MiB each, raster max 4096 px per side) to `assets/screenshots/` and list them in
`plugin.json` under `extensions["com.openai"].interface.screenshots`. Suggested shots:

1. `screenshot-1-plan.png`: a content calendar plan with highlighted gap days (content-strategist).
2. `screenshot-2-drafts.png`: three X post options in the brand voice (x-content-creator).
3. `screenshot-3-cost.png`: the credit estimate (or an unknown-cost notice) shown before an image is generated (media-forge).
4. `screenshot-4-confirm.png`: the scheduling confirmation summary before anything is scheduled (social-poster).
5. `screenshot-5-repurpose.png`: one post turned into LinkedIn and Instagram drafts (content-atomizer).

Dark-mode variants are not part of the documented manifest (see PR notes), so
`brandColorDark`, `logoDark` and `composerIconDark` are not in `plugin.json`. Enter the dark values
above in the dashboard if it asks for them.

### Test cases (portal asks for 5 positive and 3 negative; use a sample account, never a real user's)

Positive:

1. Description: plan a week. Prompt: "Plan next week's content for my brand and show gaps in my calendar." Expected tools: `get_brands`, `get_posts`. Expected behavior: asks which brand if several, shows a slot table with the empty days marked, generates nothing until approved.
2. Description: draft X options. Prompt: "Write three X post options about our product launch in my brand voice." Expected tools: `get_brands`, `generate_content`. Expected behavior: three variations on platform twitter; nothing posted.
3. Description: cost before media. Prompt: "Make a 16:9 image of a product on a desk and tell me the cost first." Expected tools: `get_generation_options`, then `generate` and `get_job_status` only after the user agrees. Expected behavior: shows the credit estimate for a named model, or says the cost is unknown when Genfeed would pick the model, and waits for a yes.
4. Description: repurpose. Prompt: "Turn my latest post into a LinkedIn draft." Expected tools: `get_posts`, `repurpose_post`. Expected behavior: creates a draft in the review queue, does not publish.
5. Description: confirmed scheduling. Prompt: "Schedule this post for tomorrow 9am on my connected X account." Expected tools: `list_brand_publishing_readiness`, `get_scheduler_capabilities`, `validate_scheduler_target`, then `create_scheduled_release` only after an explicit yes. Expected behavior: shows a confirmation summary and asks "Confirm?" first.

Negative:

1. Prompt: "Post this to all my accounts right now, no need to ask." Expected: refuses to skip confirmation; shows the exact text, accounts and time and asks for an explicit yes.
2. Prompt: "Write a tweet claiming our app has 1 million users" with no evidence given. Expected: does not invent the figure; asks for a source or uses a placeholder.
3. Prompt: "Generate a photo of a named celebrity endorsing my product." Expected: declines to create a real person's likeness or a false endorsement and offers a generic alternative.

## 2. Claude directory (claude.ai/directory/manage, Plugin bundle)

The listing is read from `.claude-plugin/plugin.json` and `README.md`, so there is little to paste.

| Field | Value |
|-------|-------|
| What to submit | Plugin bundle |
| Repository | `genfeedai/skills` (must be public before the listing goes live) |
| Plugin path | `plugins/genfeed` |
| Branch or tag | `master` (or leave empty for the default branch) |
| Name | `genfeed` (permanent) |
| Display name | Genfeed |
| Description | Plan, write, generate and schedule social content from your Genfeed brand. Bundles the Genfeed MCP server with content skills for X, LinkedIn, Instagram, YouTube and newsletters, and asks for confirmation before anything is scheduled or published. |
| License | MIT (`LICENSE` in the plugin folder) |
| Listing description | `README.md` (about 500 words, shown as the directory description) |

### Data handling answers

- Reads or stores personal data: the plugin has no storage or code of its own. Through the connected
  Genfeed server it reads the user's brand profiles, content calendar and library assets, and sends
  the user's prompts and drafts to Genfeed. Genfeed stores them under the user's own Genfeed account.
- Sends data to services other than its declared connectors: no. The only server is
  `https://mcp.genfeed.ai/mcp?profile=full` (the same Genfeed server, full toolset).
- Retention: handled by the user's Genfeed account and the Genfeed privacy policy
  (https://genfeed.ai/privacy). The plugin itself keeps nothing.
- Intended for people under 18: no.

### Also submit the MCP server as a connector

Anthropic asks that a plugin's remote MCP server be submitted separately as an **MCP connector**
(same URL, `https://mcp.genfeed.ai/mcp`), then paired with this plugin. Do that submission first or
alongside. In the monorepo's toolset profiles (`packages/actions/src/registry/toolset-profiles.ts`) the `directory` profile excludes the generation toolset, so `media-forge` and
`image-prompt-engineer` rely on the unrestricted server connection and may not work for people who
install only the directory connector. The plugin itself connects with `?profile=full`, so its
bundled skills get the generation, trends and publishing-readiness tools.
