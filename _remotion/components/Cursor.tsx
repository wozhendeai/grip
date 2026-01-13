import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { springConfig, theme } from './transitions';

interface CursorProps {
  x: number;
  y: number;
  isClicking?: boolean;
  visible?: boolean;
}

export const Cursor: React.FC<CursorProps> = ({
  x,
  y,
  isClicking = false,
  visible = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!visible) return null;

  // Click animation - cursor gets smaller when clicking
  const clickScale = isClicking ? 0.85 : 1;
  const scale = spring({
    frame,
    fps,
    config: springConfig.snappy,
    from: clickScale === 0.85 ? 1 : 0.85,
    to: clickScale,
    durationInFrames: 6,
  });

  // Click ripple effect
  const rippleOpacity = isClicking
    ? interpolate(frame % 30, [0, 15], [0.4, 0], { extrapolateRight: 'clamp' })
    : 0;
  const rippleScale = isClicking
    ? interpolate(frame % 30, [0, 15], [1, 2], { extrapolateRight: 'clamp' })
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translate(-4px, -4px)`,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Click ripple */}
      {isClicking && (
        <div
          style={{
            position: 'absolute',
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: theme.primary,
            opacity: rippleOpacity,
            transform: `scale(${rippleScale}) translate(-8px, -8px)`,
          }}
        />
      )}

      {/* Cursor pointer */}
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        style={{
          transform: `scale(${scale})`,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
      >
        {/* Cursor shape - classic pointer arrow */}
        <path
          d="M5.5 3.21V20.79L11.5 14.79H19.5L5.5 3.21Z"
          fill={theme.foreground}
          stroke={theme.background}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// Animated cursor that follows a path
interface AnimatedCursorProps {
  path: Array<{
    x: number;
    y: number;
    frame: number;
    click?: boolean;
    visible?: boolean;
  }>;
}

export const AnimatedCursor: React.FC<AnimatedCursorProps> = ({ path }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find current and next waypoint
  let currentWaypoint = path[0];
  let nextWaypoint = path[0];

  for (let i = 0; i < path.length - 1; i++) {
    if (frame >= path[i].frame && frame < path[i + 1].frame) {
      currentWaypoint = path[i];
      nextWaypoint = path[i + 1];
      break;
    }
    if (i === path.length - 2 && frame >= path[i + 1].frame) {
      currentWaypoint = path[i + 1];
      nextWaypoint = path[i + 1];
    }
  }

  // Handle edge case where waypoints have the same frame
  // (this happens when cursor stays in place or toggles visibility)
  const sameFrame = currentWaypoint.frame === nextWaypoint.frame;

  let x: number;
  let y: number;

  if (sameFrame) {
    x = currentWaypoint.x;
    y = currentWaypoint.y;
  } else {
    // Interpolate position between waypoints
    const progress = interpolate(
      frame,
      [currentWaypoint.frame, nextWaypoint.frame],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Use spring for smoother movement
    const springProgress = spring({
      frame: Math.floor(progress * fps),
      fps,
      config: { damping: 20, stiffness: 80 },
    });

    x = interpolate(springProgress, [0, 1], [currentWaypoint.x, nextWaypoint.x]);
    y = interpolate(springProgress, [0, 1], [currentWaypoint.y, nextWaypoint.y]);
  }

  // Check if we're at a click frame
  const isClicking = path.some(
    (p) => p.click && frame >= p.frame && frame < p.frame + 8
  );

  // Check visibility
  const isVisible = currentWaypoint.visible !== false;

  return <Cursor x={x} y={y} isClicking={isClicking} visible={isVisible} />;
};
