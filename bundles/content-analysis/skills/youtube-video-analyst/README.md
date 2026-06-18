# Youtube Video Analyst

Deconstruct YouTube videos and transcripts into hooks, retention mechanics, emotional beats, structure, and reusable blueprints.

## Installation

```bash
bunx skills add genfeedai/skills/youtube-video-analyst
```

## Usage

```text
"Analyze this YouTube transcript and extract the hook formula"
"Deconstruct why this video retained viewers"
"Turn this video into a reusable content blueprint"
"Find the emotional beats in this YouTube script"
```

## Boundary

- Use for analysis of existing YouTube videos or transcripts.
- Use `youtube-content-creator` to create new YouTube titles, descriptions, tags, thumbnails, Shorts scripts, and retention plans.
- Use `content-atomizer` after analysis to repurpose the blueprint across platforms.

## What It Does

- Fetches or works from transcripts when available
- Breaks down hooks, pattern interrupts, open loops, emotional engineering, and retention moves
- Produces a structural blueprint that can be cloned ethically for new content
- Separates observed evidence from inferred creative strategy

## Structure

- `SKILL.md` - main instructions
- `metadata.json` - triggers, tags, outputs, and references
- `references/` - supporting reference material loaded only when needed
- `scripts/` - executable helpers or workers used by the skill

## License

MIT
