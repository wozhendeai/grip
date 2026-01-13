import { Easing, interpolate, spring, SpringConfig } from 'remotion';

// Dark theme colors from globals.css (oklch converted to hex)
export const theme = {
  background: '#161618',
  foreground: '#fafafa',
  card: '#27272a',
  cardForeground: '#fafafa',
  primary: '#e4e4e7',
  primaryForeground: '#27272a',
  secondary: '#3f3f46',
  secondaryForeground: '#fafafa',
  muted: '#3f3f46',
  mutedForeground: '#a1a1aa',
  border: 'rgba(255,255,255,0.1)',
  input: 'rgba(255,255,255,0.15)',
  success: '#22c55e',
  successForeground: '#052e16',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
} as const;

// Transparent versions for backgrounds
export const themeAlpha = {
  success10: 'rgba(34, 197, 94, 0.1)',
  success20: 'rgba(34, 197, 94, 0.2)',
  primary10: 'rgba(228, 228, 231, 0.1)',
  primary20: 'rgba(228, 228, 231, 0.2)',
  muted30: 'rgba(63, 63, 70, 0.3)',
  muted50: 'rgba(63, 63, 70, 0.5)',
  border50: 'rgba(255,255,255,0.05)',
} as const;

// Animation configs
export const springConfig = {
  gentle: { damping: 20, stiffness: 100, mass: 1, overshootClamping: false } satisfies SpringConfig,
  snappy: { damping: 15, stiffness: 200, mass: 1, overshootClamping: false } satisfies SpringConfig,
  bouncy: { damping: 10, stiffness: 150, mass: 1, overshootClamping: false } satisfies SpringConfig,
} as const;

// Cursor movement with easing
export function cursorPosition(
  frame: number,
  fromFrame: number,
  toFrame: number,
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number } {
  const x = interpolate(frame, [fromFrame, toFrame], [from.x, to.x], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [fromFrame, toFrame], [from.y, to.y], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { x, y };
}

// Typing animation helper
export function typedText(
  frame: number,
  startFrame: number,
  text: string,
  charsPerSecond: number = 10,
  fps: number = 30
): string {
  const framesPerChar = fps / charsPerSecond;
  const elapsedFrames = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(text.length, Math.floor(elapsedFrames / framesPerChar));
  return text.slice(0, charsToShow);
}

// Button press animation
export function buttonPress(
  frame: number,
  pressFrame: number,
  fps: number = 30
): { scale: number; brightness: number } {
  const pressDuration = 4;
  const isPressed = frame >= pressFrame && frame < pressFrame + pressDuration;

  if (isPressed) {
    return { scale: 0.97, brightness: 0.9 };
  }

  // Spring back after press
  if (frame >= pressFrame + pressDuration) {
    const scale = spring({
      frame: frame - (pressFrame + pressDuration),
      fps,
      config: springConfig.snappy,
      from: 0.97,
      to: 1,
    });
    return { scale, brightness: 1 };
  }

  return { scale: 1, brightness: 1 };
}

// Fade in animation
export function fadeIn(
  frame: number,
  startFrame: number,
  durationFrames: number = 15
): number {
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

// Slide in animation
export function slideIn(
  frame: number,
  startFrame: number,
  fps: number,
  direction: 'up' | 'down' | 'left' | 'right' = 'up',
  distance: number = 20
): { x: number; y: number; opacity: number } {
  const offset = spring({
    frame: frame - startFrame,
    fps,
    config: springConfig.gentle,
    from: distance,
    to: 0,
  });

  const opacity = fadeIn(frame, startFrame, 10);

  const directions = {
    up: { x: 0, y: offset },
    down: { x: 0, y: -offset },
    left: { x: offset, y: 0 },
    right: { x: -offset, y: 0 },
  };

  return { ...directions[direction], opacity };
}

// Loading spinner rotation
export function spinnerRotation(frame: number, fps: number = 30): number {
  const rotationsPerSecond = 1;
  return (frame / fps) * rotationsPerSecond * 360;
}

// Pulse animation for loading states
export function pulse(frame: number, fps: number = 30): number {
  const period = fps; // 1 second
  const t = (frame % period) / period;
  return 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
}

// Border radius values matching tailwind
export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  full: 9999,
} as const;

// Spacing values (based on 4px grid)
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// Font sizes
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

// Font weights
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;
