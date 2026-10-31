import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface MotionProps {
  accent: string;
  background: string;
  foreground: string;
  handle: string;
  subtitle: string;
  title: string;
}

/**
 * Frame-driven only: every value comes from useCurrentFrame(), never from
 * Date.now(), CSS transitions or setTimeout, so any frame renders the same.
 */
export function VisualComposition({
  accent,
  background,
  foreground,
  handle,
  subtitle,
  title,
}: MotionProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  const enter = spring({ fps, frame, config: { damping: 200 } });
  const titleY = interpolate(enter, [0, 1], [80, 0]);
  const barWidth = interpolate(frame, [0, 24], [0, width * 0.22], {
    extrapolateRight: 'clamp',
  });
  const subtitleOpacity = interpolate(frame, [18, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const endStart = durationInFrames - fps; // last second is the end card
  const endOpacity = interpolate(frame, [endStart, endStart + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background,
        color: foreground,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        justifyContent: 'center',
        padding: 96,
      }}
    >
      <div
        style={{
          background: accent,
          borderRadius: 8,
          height: 12,
          marginBottom: 48,
          width: barWidth,
        }}
      />
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.05,
          opacity: enter,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: foreground,
          fontSize: 52,
          marginTop: 40,
          opacity: subtitleOpacity * 0.8,
        }}
      >
        {subtitle}
      </div>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          background,
          justifyContent: 'center',
          opacity: endOpacity,
        }}
      >
        <div style={{ color: accent, fontSize: 84, fontWeight: 800 }}>{handle}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
