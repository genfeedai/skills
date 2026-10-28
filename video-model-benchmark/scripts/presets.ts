// Ready-made prompts for the benchmark. Each one is picked to expose a visible difference between
// models and to be catchy in a feed. All subjects are fictional or generic: no real people, no
// real-person likenesses, nothing explicit.

export interface PromptPreset {
  name: string;
  prompt: string;
  /** Default "what to look at" line for the post copy. */
  lookFor: string;
}

export const PROMPT_PRESETS: PromptPreset[] = [
  {
    name: 'motion-coherence',
    prompt:
      'A courier carries a stack of four flat boxes across a busy pavement, turns side-on to pass a lamp post, and continues. Single continuous shot, handheld, daylight.',
    lookFor: 'Compare how each handles a stack of boxes turning side-on past a lamp post.',
  },
  {
    name: 'fit-woman',
    prompt:
      'A fit woman in black athleisure finishes a set of kettlebell swings in a sunlit rooftop gym at golden hour, wipes her brow and smiles at the camera. Handheld, shallow depth of field, warm light.',
    lookFor: 'Compare skin, muscle definition and how the kettlebell moves.',
  },
  {
    name: 'camera-orbit',
    prompt:
      'A smooth 360-degree orbit around a sprinter frozen mid-stride on a wet city street at night, neon reflections, rain droplets hanging in the air. The camera never stops moving.',
    lookFor: 'Compare how each holds the subject while the camera circles it.',
  },
  {
    name: 'camera-crane',
    prompt:
      'A crane shot rising from street level over a lone surfer carrying a board across an empty beach at sunrise, climbing to reveal the whole coastline.',
    lookFor: 'Compare how each handles a long rising camera move and the reveal.',
  },
  {
    name: 'camera-pushin',
    prompt:
      'A fast push-in from a wide shot of a boxer alone in an empty arena to an extreme close-up of their eyes, sweat and spotlight haze.',
    lookFor: 'Compare the push-in speed, the face detail at the end and the lighting.',
  },
  {
    name: 'dbz-fight',
    prompt:
      'Anime action fight in a hand-drawn 90s style: three original fighters in mid-air combat above a ruined rocky plateau, one with spiky silver hair and a torn crimson jacket, one huge and armoured in a purple cape, one lean in blue wrapped in a glowing green aura. Energy beams, shockwaves, rapid camera whip-pans.',
    lookFor: 'Compare the energy effects, the speed of the fight and how well the style holds.',
  },
];

export function findPreset(name: string): PromptPreset | undefined {
  return PROMPT_PRESETS.find((p) => p.name === name);
}
