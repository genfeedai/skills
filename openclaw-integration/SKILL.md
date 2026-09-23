---
name: openclaw-integration
description: Connect agents and workflows to Genfeed.ai through MCP or CLI for content generation, publishing, and platform tool access. Triggers on Genfeed MCP, OpenClaw, platform connection, content generation through Genfeed, and publishing via Genfeed.
license: MIT
metadata:
  author: genfeedai
  version: 1.0.0
---

# OpenClaw Integration

This skill is a pointer. The maintained Genfeed agent package is [github.com/genfeedai/agent](https://github.com/genfeedai/agent).

- Playbook and client manifests: that repository
- Hosted MCP server: `https://mcp.genfeed.ai/mcp`
- Recommended connect URL: `https://mcp.genfeed.ai/mcp?toolsets=core,scheduler,content,generation,analytics,onboarding`

Authenticate with OAuth. On 401, stop. Do not search for a credential, and do not put a key in the URL. An API key is an `Authorization: Bearer` header only.

Do not use tool names from older copies of this file. They are not the Genfeed MCP catalog. Follow `skills/genfeed/SKILL.md` in `genfeedai/agent`.
