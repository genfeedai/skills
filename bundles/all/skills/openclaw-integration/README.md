# Openclaw Integration

Connect agents and workflows to Genfeed.ai through MCP or CLI so they can generate, publish, and manage content through the platform.

## Installation

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

- Explains authentication and available Genfeed platform tools
- Supports MCP and CLI-oriented workflows
- Routes common content generation and publishing tasks into Genfeed
- Documents error handling and connection checks

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
