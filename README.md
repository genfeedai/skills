# Genfeed Skills

AI-powered skills for building workflows, creating custom nodes, and getting started with Genfeed.

## Installation

Install all skills from this repository:

```bash
npx skills add genfeedai/skills
```

Or install individual skills:

```bash
npx skills add genfeedai/skills/workflow-creator
npx skills add genfeedai/skills/node-creator
npx skills add genfeedai/skills/onboarding
npx skills add genfeedai/skills/prompt-generator
npx skills add genfeedai/skills/scope-validator
npx skills add genfeedai/skills/openclaw-integration
```

## Available Skills

### workflow-creator

Create Genfeed workflows from natural language descriptions.

**Triggers:**

- "create a workflow"
- "build a content pipeline"
- "make a video generation workflow"

**Output:** Complete workflow JSON ready for import into Genfeed Studio

[Documentation](./workflow-creator/README.md)

---

### node-creator

Create custom nodes using the Genfeed SDK's fluent builder API.

**Triggers:**

- "create a new node"
- "add a custom node type"
- "build a node for X"

**Output:** TypeScript code for a complete node definition

[Documentation](./node-creator/README.md)

---

### onboarding

Quick onboarding focused on creating your first content in under 10 minutes.

**Triggers:**

- "how do I use genfeed"
- "getting started"
- "help me create my first content"

**Output:** Step-by-step instructions for first workflow

[Documentation](./onboarding/README.md)

---

### prompt-generator

Generate optimized prompts for AI image and video generation.

**Triggers:**

- "generate a prompt for"
- "write me a prompt"
- "create an image prompt"

**Output:** Structured JSON with optimized prompt, style settings, and model recommendation

[Documentation](./prompt-generator/README.md)

---

### scope-validator

Validate feature requests against Genfeed OSS core vs Cloud scope.

**Triggers:**

- "should this be in core or cloud"
- "is this feature OSS or cloud"
- "can I contribute this to core"

**Output:** Scope determination with guidance on where to submit

[Documentation](./scope-validator/README.md)

---

### openclaw-integration

Connect AI agents to Genfeed.ai via MCP for content creation, publishing, and analytics.

**Triggers:**

- "connect to genfeed"
- "use genfeed"
- "genfeed mcp"

**Output:** MCP configuration and tool usage instructions

[Documentation](./openclaw-integration/README.md)

## Skills Structure

```
skills/
├── README.md                 # This file
├── workflow-creator/
│   ├── SKILL.md              # Main skill with YAML frontmatter
│   ├── README.md             # User documentation
│   └── metadata.json         # Extended metadata
├── node-creator/
│   ├── SKILL.md
│   ├── README.md
│   └── metadata.json
├── onboarding/
│   ├── SKILL.md
│   ├── README.md
│   └── metadata.json
├── prompt-generator/
│   ├── SKILL.md
│   ├── README.md
│   └── metadata.json
├── scope-validator/
│   ├── SKILL.md
│   ├── README.md
│   └── metadata.json
└── openclaw-integration/
    ├── SKILL.md
    ├── README.md
    └── metadata.json
```

## SKILL.md Format

Each skill uses the skills.sh format with YAML frontmatter:

```yaml
---
name: skill-name
description: When to use this skill and trigger phrases
license: MIT
metadata:
  author: genfeedai
  version: "1.0.0"
---

# Skill Content
Instructions for the agent...
```

## Contributing

1. Fork the repository
2. Create your skill in `skills/your-skill-name/`
3. Include SKILL.md, README.md, and metadata.json
4. Submit a pull request

## License

MIT
