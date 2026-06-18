# Startup Icp Definer

Define a precise startup ICP with company profile, buyer persona, user persona, buying center, pains, and triggers.

## Installation

```bash
bunx skills add genfeedai/skills/startup-icp-definer
```

## Usage

```text
"Define the ICP for this B2B SaaS"
"Who should I target first with this offer?"
"Map the buying center for this product"
"Turn this broad audience into a specific customer profile"
```

## Boundary

- Use before lead research, outbound, offer design, and traffic planning when the target customer is unclear.
- Use `leads-researcher` after this to find accounts and contacts matching the ICP.
- Use `content-strategist` for audience-to-content planning after ICP is defined.

## What It Does

- Defines company profile, buyer persona, user persona, and buying center
- Scores pains by urgency, cost, frequency, and active search behavior
- Applies the 50-company test to avoid vague ICPs
- Outputs target segments, exclusions, triggers, and next validation steps

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed

## License

MIT
