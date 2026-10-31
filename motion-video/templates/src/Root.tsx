import { Composition } from 'remotion';
import type { MotionProps } from './VisualComposition';
import { VisualComposition } from './VisualComposition';

const DEFAULT_PROPS: MotionProps = {
  accent: '#7c5cff',
  background: '#0b0b10',
  foreground: '#f5f5f7',
  handle: '@genfeedai',
  subtitle: 'Rendered on your own machine',
  title: 'Motion without an API bill',
};

export function Root() {
  return (
    <Composition
      id="Main"
      component={VisualComposition}
      defaultProps={DEFAULT_PROPS}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}
