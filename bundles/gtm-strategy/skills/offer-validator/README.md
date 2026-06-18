# Offer Validator

Score and improve an existing offer against the Value Equation before launch or scale.

## Installation

```bash
bunx skills add genfeedai/skills/offer-validator
```

## Usage

```text
"Validate my offer before launch"
"Rate this offer and tell me what is weak"
"Score this value stack"
"Why is this offer not converting?"
```

## Boundary

- Use when an offer already exists and needs scoring, diagnosis, or targeted fixes.
- Use `offer-architect` to build the offer from scratch or perform a major rebuild.
- Use `funnel-validator` when the offer is acceptable but the sequence or funnel may be leaking.

## What It Does

- Scores dream outcome, perceived likelihood, time to results, effort required, bonus stack, and guarantee strength
- Flags weak proof, vague outcomes, slow time-to-value, and high customer effort
- Prescribes fixes without overhauling what already works
- Routes severe offer problems back to `offer-architect`

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed

## License

MIT
