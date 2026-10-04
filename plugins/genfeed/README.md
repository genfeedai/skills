# Genfeed

Plan, write, generate and schedule social content from your Genfeed brand, directly in your AI assistant. This plugin connects the remote Genfeed MCP server and adds twelve skills that tell the assistant which Genfeed tools to call, and in what order, for each content task.

## What you get

| Skill | Use it to |
|-------|-----------|
| `content-strategist` | Plan a calendar and find gaps in what is already scheduled |
| `copywriter` | Write short conversion copy with variations in your brand voice |
| `x-content-creator` | Draft X posts and threads, with optional topic research on X |
| `linkedin-content-creator` | Draft LinkedIn posts and long-form pieces |
| `instagram-content-creator` | Write captions, Reel scripts and carousel outlines, then a matching visual |
| `youtube-content-creator` | Script a video, write titles and descriptions, brief a thumbnail |
| `newsletter-creator` | Draft a newsletter edition and subject lines |
| `content-atomizer` | Repurpose one post into drafts for other channels |
| `social-poster` | Validate, then schedule or save a release, after your explicit confirmation |
| `media-forge` | Generate or edit images, video, voice and music, with a cost estimate first |
| `image-prompt-engineer` | Turn a rough visual idea into a precise generation prompt |
| `trend-scout` | Find trending topics and rank them against your brand |

## Use it

Install the plugin, connect the Genfeed server when your assistant asks you to sign in, then describe what you want. For example: "Plan next week's content and show me the gaps in my calendar", "Write three X post options about our launch", or "Generate an Instagram image for this caption and tell me the cost first".

The assistant reads your brand profile with `get_brands` and uses it for tone. If you have several brands it asks which one to use.

## Safety

Nothing is scheduled or published until you confirm the exact text, account and time. Drafts are the default. Image and video generation shows a credit estimate first. Pausing or cancelling a scheduled post never needs a second prompt.

## Data

The plugin has no code of its own and stores nothing. When you use a skill, your prompts, the brand and calendar data it reads, and any text or media you ask it to generate or schedule are sent to the Genfeed MCP server at `mcp.genfeed.ai` and are covered by the [Genfeed privacy policy](https://genfeed.ai/privacy) and [terms](https://genfeed.ai/terms). Generation and some text tools spend Genfeed credits. A Genfeed account is required.

## Tool availability

The server's default connection exposes the core, generation, content and scheduler toolsets. A few helpers used by `trend-scout`, `social-poster` and `content-strategist` (such as `get_trends` and `list_brand_publishing_readiness`) can be outside that default set; the skills call `find_tools` to check and say so when a tool is missing.

## Packaging

The same folder serves two formats. `plugin.json` and `mcp.json` follow the portable [Agent Plugins](https://agent-plugins.org) 1.0 format used by ChatGPT, Codex, Copilot and Cursor. `.claude-plugin/plugin.json` and `.mcp.json` are the Claude plugin manifest. Both share the `skills/` and `assets/` folders.

## License

MIT. See `LICENSE`.
