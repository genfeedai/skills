# Constraint Eliminator

Map and remove the obstacles between purchase and customer success.

## Installation

```bash
bunx skills add genfeedai/skills/constraint-eliminator
```

## Usage

```text
"Customers buy but do not implement. Fix the offer experience"
"Map the objections blocking this sale"
"Design a guarantee for this service"
"Turn this DIY offer into a done-for-you version"
```

## Boundary

- Use after the offer exists and customer friction is visible or predictable.
- Use `offer-architect` to create the offer itself, and `offer-validator` to score the offer value equation.
- Use `support-systems-architect` when the main problem is support volume, documentation, or ticket deflection.

## What It Does

- Inventories every action customers must take to succeed
- Maps objections to underlying fears and risk reversals
- Designs done-for-you, done-with-you, and guided service levels
- Creates guarantees, onboarding fixes, and friction removal plans

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references

## License

MIT
