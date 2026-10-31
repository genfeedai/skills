# Video Brand Profile

Defines one reusable brand profile for video: signature or logo placement, caption font and position, thumbnail rules and export sizes. The Genfeed YouTube and TikTok skills read it first.

## Installation

```bash
bunx skills add genfeedai/skills --skill video-brand-profile
```

## Usage

```
"Write a video brand profile for our channel from the brand kit"
"Where should the logo go on a 9:16 clip and on the thumbnail?"
"Which caption font and position do we use for Shorts?"
"Check this export against our video brand profile"
```

## What It Does

- Turns a brand kit into values a renderer or editor can use
- Marks each value approved, built or proposed, with its source
- Converts placement to canvas-width ratios so it works at any export size
- Ships a complete worked example (Ship Sh!t Show)

## License

MIT
