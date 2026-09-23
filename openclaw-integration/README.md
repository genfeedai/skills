# Openclaw Integration

Pointer to the maintained Genfeed agent package at [github.com/genfeedai/agent](https://github.com/genfeedai/agent). Hosted MCP: `https://mcp.genfeed.ai/mcp`.

## Installation

Install the maintained package:

```bash
bunx skills add genfeedai/agent
```

This folder remains installable as a short pointer:

```bash
bunx skills add genfeedai/skills/openclaw-integration
```

## Usage

```text
"Connect this agent to Genfeed via MCP"
"Show me the Genfeed content generation tools"
"Use Genfeed to generate an image from this prompt"
"Publish content through Genfeed platform tools"
```

## Boundary

- Use for platform connection and tool access through MCP or CLI.
- Use `genfeed-connector` for the content-loop state seam, token lookup, manifests, and feedback commands.
- Use `workflow-creator` when the goal is to design a Studio workflow rather than connect an agent.

## What It Does

- Points agents at `genfeedai/agent` for the playbook, manifests, and install paths
- Names the hosted MCP server
- Leaves tool instructions in that repository

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
