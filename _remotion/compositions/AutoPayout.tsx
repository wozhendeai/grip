import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import {
  theme,
  themeAlpha,
  radius,
  spacing,
  fontSize,
  fontWeight,
  fadeIn,
  slideIn,
  springConfig,
  pulse,
} from '../components/transitions';
import {
  Badge,
  Card,
  CheckIcon,
  Spinner,
  Avatar,
  AddressDisplay,
} from '../components/MockUI';

// Timeline (frames at 30fps) - 12 seconds = 360 frames
// Each scene gets ~3 seconds with transitions
const TIMELINE = {
  // Scene 1: PR Merge
  PR_ENTER: 0,
  PR_MERGE: 45,           // 1.5s - PR merges
  PR_EXIT: 90,            // 3s - Fade out

  // Scene 2: Webhook
  WEBHOOK_ENTER: 90,
  WEBHOOK_PULSE: 120,     // 4s - Pulse animation
  WEBHOOK_EXIT: 170,      // 5.67s

  // Scene 3: Bounty Status
  BOUNTY_ENTER: 170,
  BOUNTY_PROCESSING: 200, // 6.67s
  BOUNTY_PAID: 240,       // 8s
  BOUNTY_EXIT: 270,       // 9s

  // Scene 4: Profile
  PROFILE_ENTER: 270,
  PROFILE_COUNT: 300,     // 10s - Counter animation
  LOOP_POINT: 360,        // 12s
};

export const AutoPayout: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene visibility calculations
  const scene1Opacity = getSceneOpacity(frame, TIMELINE.PR_ENTER, TIMELINE.PR_EXIT, 20);
  const scene2Opacity = getSceneOpacity(frame, TIMELINE.WEBHOOK_ENTER, TIMELINE.WEBHOOK_EXIT, 20);
  const scene3Opacity = getSceneOpacity(frame, TIMELINE.BOUNTY_ENTER, TIMELINE.BOUNTY_EXIT, 20);
  const scene4Opacity = getSceneOpacity(frame, TIMELINE.PROFILE_ENTER, TIMELINE.LOOP_POINT, 20);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Scene 1: PR Merge */}
      {scene1Opacity > 0 && (
        <Scene opacity={scene1Opacity}>
          <PRMergeScene frame={frame} />
        </Scene>
      )}

      {/* Scene 2: Webhook Received */}
      {scene2Opacity > 0 && (
        <Scene opacity={scene2Opacity}>
          <WebhookScene frame={frame} />
        </Scene>
      )}

      {/* Scene 3: Bounty Status */}
      {scene3Opacity > 0 && (
        <Scene opacity={scene3Opacity}>
          <BountyStatusScene frame={frame} />
        </Scene>
      )}

      {/* Scene 4: Profile */}
      {scene4Opacity > 0 && (
        <Scene opacity={scene4Opacity}>
          <ProfileScene frame={frame} />
        </Scene>
      )}
    </AbsoluteFill>
  );
};

// Scene wrapper for centering content
const Scene: React.FC<{ children: React.ReactNode; opacity: number }> = ({
  children,
  opacity,
}) => (
  <AbsoluteFill
    style={{
      opacity,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <div style={{ transform: 'scale(2)' }}>{children}</div>
  </AbsoluteFill>
);

// Helper for scene fade in/out
function getSceneOpacity(
  frame: number,
  enterFrame: number,
  exitFrame: number,
  transitionDuration: number
): number {
  const fadeInEnd = enterFrame + transitionDuration;
  const fadeOutStart = exitFrame - transitionDuration;

  if (frame < enterFrame) return 0;
  if (frame > exitFrame) return 0;

  // Fade in
  if (frame < fadeInEnd) {
    return interpolate(frame, [enterFrame, fadeInEnd], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  // Fade out
  if (frame > fadeOutStart) {
    return interpolate(frame, [fadeOutStart, exitFrame], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  }

  return 1;
}

// =============================================================================
// Scene 1: PR Merge
// =============================================================================
const PRMergeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const isMerged = frame >= TIMELINE.PR_MERGE;

  // Entry animation
  const entryAnim = slideIn(frame, TIMELINE.PR_ENTER, fps, 'up', 40);

  // Merge celebration effect
  const mergeScale = isMerged
    ? spring({
        frame: frame - TIMELINE.PR_MERGE,
        fps,
        config: springConfig.bouncy,
        from: 1,
        to: 1.02,
      })
    : 1;

  const glowOpacity = isMerged
    ? interpolate(frame, [TIMELINE.PR_MERGE, TIMELINE.PR_MERGE + 30], [0.6, 0], {
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <div
      style={{
        transform: `translateY(${entryAnim.y}px) scale(${mergeScale})`,
        position: 'relative',
      }}
    >
      {/* Glow effect on merge */}
      {isMerged && (
        <div
          style={{
            position: 'absolute',
            inset: -20,
            borderRadius: radius.xl + 20,
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
            opacity: glowOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      <Card style={{ width: 600, padding: spacing[8] }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing[3],
            marginBottom: spacing[6],
          }}
        >
          <GitHubIcon />
          <span
            style={{
              fontSize: fontSize.sm,
              color: theme.mutedForeground,
            }}
          >
            acme/webapp
          </span>
        </div>

        {/* PR Info */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[4] }}>
          <PRStatusIcon merged={isMerged} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: fontSize.xl,
                fontWeight: fontWeight.bold,
                color: theme.foreground,
                marginBottom: spacing[2],
              }}
            >
              Implement dark mode toggle component
            </div>
            <div
              style={{
                fontSize: fontSize.sm,
                color: theme.mutedForeground,
                display: 'flex',
                alignItems: 'center',
                gap: spacing[2],
              }}
            >
              <span>#105</span>
              <span>•</span>
              <span>by lili-chen</span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ marginTop: spacing[6], display: 'flex', justifyContent: 'flex-end' }}>
          <Badge
            style={{
              backgroundColor: isMerged ? 'rgba(139, 92, 246, 0.15)' : themeAlpha.success10,
              color: isMerged ? '#a78bfa' : theme.success,
              padding: `${spacing[2]}px ${spacing[4]}px`,
              fontSize: fontSize.sm,
            }}
          >
            {isMerged ? 'Merged' : 'Open'}
          </Badge>
        </div>
      </Card>
    </div>
  );
};

// =============================================================================
// Scene 2: Webhook Received
// =============================================================================
const WebhookScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const entryAnim = slideIn(frame, TIMELINE.WEBHOOK_ENTER, fps, 'up', 40);
  const pulseValue = pulse(frame, fps);

  // Ripple animation
  const rippleProgress = interpolate(
    (frame - TIMELINE.WEBHOOK_ENTER) % 60,
    [0, 60],
    [0, 1]
  );

  return (
    <div
      style={{
        transform: `translateY(${entryAnim.y}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[8],
      }}
    >
      {/* Webhook icon with pulse */}
      <div style={{ position: 'relative' }}>
        {/* Ripple rings */}
        {[0, 1, 2].map((i) => {
          const delay = i * 0.33;
          const ringProgress = (rippleProgress + delay) % 1;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: -30 - ringProgress * 40,
                borderRadius: radius.full,
                border: `2px solid rgba(139, 92, 246, ${0.5 * (1 - ringProgress)})`,
                pointerEvents: 'none',
              }}
            />
          );
        })}

        {/* Icon container */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: radius.full,
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${1 + 0.03 * pulseValue})`,
          }}
        >
          <svg
            width={56}
            height={56}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a78bfa"
            strokeWidth={1.5}
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: theme.foreground,
            marginBottom: spacing[2],
          }}
        >
          Webhook Received
        </div>
        <div
          style={{
            fontSize: fontSize.base,
            color: theme.mutedForeground,
          }}
        >
          PR #105 merged → Processing payout...
        </div>
      </div>

      {/* Event details card */}
      <Card style={{ width: 400, padding: spacing[4] }}>
        <div style={{ fontFamily: 'monospace', fontSize: fontSize.xs, color: theme.mutedForeground }}>
          <div style={{ color: theme.success, marginBottom: spacing[1] }}>POST /api/webhooks/github</div>
          <div>{"{"}</div>
          <div style={{ paddingLeft: spacing[4] }}>
            <span style={{ color: '#a78bfa' }}>"action"</span>: "closed",
          </div>
          <div style={{ paddingLeft: spacing[4] }}>
            <span style={{ color: '#a78bfa' }}>"merged"</span>: true,
          </div>
          <div style={{ paddingLeft: spacing[4] }}>
            <span style={{ color: '#a78bfa' }}>"pull_request"</span>: {"{ ... }"}
          </div>
          <div>{"}"}</div>
        </div>
      </Card>
    </div>
  );
};

// =============================================================================
// Scene 3: Bounty Status
// =============================================================================
const BountyStatusScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const entryAnim = slideIn(frame, TIMELINE.BOUNTY_ENTER, fps, 'up', 40);
  const isProcessing = frame >= TIMELINE.BOUNTY_PROCESSING && frame < TIMELINE.BOUNTY_PAID;
  const isPaid = frame >= TIMELINE.BOUNTY_PAID;
  const pulseValue = pulse(frame, fps);

  // Progress bar animation
  const progress = interpolate(
    frame,
    [TIMELINE.BOUNTY_PROCESSING, TIMELINE.BOUNTY_PAID],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        transform: `translateY(${entryAnim.y}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[6],
      }}
    >
      {/* Status icon */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: radius.full,
          backgroundColor: isPaid ? themeAlpha.success10 : 'rgba(234, 179, 8, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPaid ? (
          <CheckIcon size={50} color={theme.success} />
        ) : (
          <Spinner size={50} color="#eab308" />
        )}
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: theme.foreground,
            marginBottom: spacing[2],
          }}
        >
          {isPaid ? 'Bounty Paid!' : 'Processing Payout...'}
        </div>
        <div style={{ fontSize: fontSize.base, color: theme.mutedForeground }}>
          {isPaid ? 'Funds sent to contributor' : 'Executing blockchain transaction'}
        </div>
      </div>

      {/* Bounty card */}
      <Card style={{ width: 500, padding: spacing[6] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[4] }}>
          <Avatar fallback="A" size={48} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: fontSize.lg,
                fontWeight: fontWeight.semibold,
                color: theme.foreground,
              }}
            >
              Add dark mode support
            </div>
            <div style={{ fontSize: fontSize.sm, color: theme.mutedForeground }}>
              #142 • acme/webapp
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[2],
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: isPaid ? theme.mutedForeground : theme.success,
              textDecoration: isPaid ? 'line-through' : 'none',
            }}
          >
            <Img
              src={staticFile('icons/pathusd.svg')}
              style={{ width: 24, height: 24, borderRadius: radius.full }}
            />
            250
          </div>
        </div>

        {/* Progress bar */}
        {isProcessing && (
          <div style={{ marginTop: spacing[4] }}>
            <div
              style={{
                height: 6,
                backgroundColor: themeAlpha.muted30,
                borderRadius: radius.full,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#eab308',
                  borderRadius: radius.full,
                }}
              />
            </div>
          </div>
        )}

        {/* Status */}
        <div style={{ marginTop: spacing[4], display: 'flex', justifyContent: 'flex-end' }}>
          <Badge
            variant={isPaid ? 'success' : 'outline'}
            style={
              isProcessing && !isPaid
                ? {
                    backgroundColor: 'rgba(234, 179, 8, 0.1)',
                    color: '#eab308',
                    borderColor: 'rgba(234, 179, 8, 0.3)',
                  }
                : {}
            }
          >
            {isPaid ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckIcon size={12} color={theme.success} animated={false} />
                Paid
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Spinner size={10} color="#eab308" />
                Processing
              </span>
            )}
          </Badge>
        </div>
      </Card>
    </div>
  );
};

// =============================================================================
// Scene 4: Profile (matches actual ProfileHeader + ProfileStats layout)
// =============================================================================
const ProfileScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const entryAnim = slideIn(frame, TIMELINE.PROFILE_ENTER, fps, 'up', 40);

  // Animated counter for earnings
  const countStart = TIMELINE.PROFILE_ENTER + 20;
  const earningsProgress = interpolate(frame, [countStart, countStart + 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const previousEarnings = 1250;
  const newEarnings = 1500;
  const displayEarnings = Math.floor(
    previousEarnings + (newEarnings - previousEarnings) * earningsProgress
  );

  // Badge pop animation
  const badgeScale = spring({
    frame: Math.max(0, frame - countStart - 30),
    fps,
    config: springConfig.bouncy,
  });

  return (
    <div
      style={{
        transform: `translateY(${entryAnim.y}px)`,
        width: 700,
      }}
    >
      {/* Profile Header - Horizontal layout */}
      <div
        style={{
          display: 'flex',
          gap: spacing[8],
          padding: `${spacing[8]}px 0`,
        }}
      >
        {/* Avatar */}
        <div style={{ flexShrink: 0 }}>
          <Img
            src={staticFile('videos/lili-chen.png')}
            style={{
              width: 128,
              height: 128,
              borderRadius: radius.full,
              border: `4px solid ${theme.background}`,
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              objectFit: 'cover',
            }}
          />
        </div>

        {/* Content Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
          {/* Name Row */}
          <div>
            <div
              style={{
                fontSize: fontSize['3xl'],
                fontWeight: fontWeight.bold,
                color: theme.foreground,
                letterSpacing: -0.5,
              }}
            >
              Lili Chen
            </div>
            <div
              style={{
                fontSize: fontSize.lg,
                color: theme.mutedForeground,
                marginTop: spacing[1],
              }}
            >
              @lili-chen
            </div>
          </div>

          {/* Bio */}
          <div
            style={{
              fontSize: fontSize.base,
              color: theme.mutedForeground,
              lineHeight: 1.5,
            }}
          >
            Full-stack developer passionate about open source. Building the future of decentralized payments.
          </div>

          {/* Metadata Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[6],
              fontSize: fontSize.sm,
              color: theme.mutedForeground,
            }}
          >
            <MetadataItem icon="location" text="San Francisco, CA" />
            <MetadataItem icon="link" text="sarah.dev" />
            <MetadataItem icon="calendar" text="Joined Jan 2025" />
          </div>

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: spacing[3],
              marginTop: spacing[2],
            }}
          >
            <ProfileStatCard
              icon="check"
              iconColor={theme.success}
              value="12"
              label="Bounties"
            />
            <ProfileStatCard
              icon="dollar"
              iconColor={theme.primary}
              value={`$${displayEarnings.toLocaleString()}`}
              label="Earned"
              highlight
            />
            <ProfileStatCard
              icon="zap"
              iconColor="#eab308"
              value="2"
              label="Active"
            />
          </div>
        </div>
      </div>

      {/* Recent earning notification */}
      <div
        style={{
          marginTop: spacing[4],
          display: 'flex',
          justifyContent: 'center',
          transform: `scale(${badgeScale})`,
        }}
      >
        <Badge
          variant="success"
          style={{
            padding: `${spacing[2]}px ${spacing[5]}px`,
            fontSize: fontSize.sm,
            display: 'flex',
            alignItems: 'center',
            gap: spacing[2],
          }}
        >
          <Img
            src={staticFile('icons/pathusd.svg')}
            style={{ width: 16, height: 16, borderRadius: radius.full }}
          />
          +250 from Issue #142
        </Badge>
      </div>
    </div>
  );
};

// Profile stat card matching ProfileStats component
const ProfileStatCard: React.FC<{
  icon: 'check' | 'dollar' | 'zap';
  iconColor: string;
  value: string;
  label: string;
  highlight?: boolean;
}> = ({ icon, iconColor, value, label, highlight }) => {
  const icons = {
    check: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    dollar: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    zap: (
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth={2}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[1],
        padding: spacing[4],
        borderRadius: radius.lg,
        border: `1px solid ${theme.border}`,
        backgroundColor: highlight ? themeAlpha.success10 : 'transparent',
      }}
    >
      {icons[icon]}
      <span
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: highlight ? theme.success : theme.foreground,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: fontSize.xs,
          color: theme.mutedForeground,
        }}
      >
        {label}
      </span>
    </div>
  );
};

// Metadata item with icon
const MetadataItem: React.FC<{
  icon: 'location' | 'link' | 'calendar';
  text: string;
}> = ({ icon, text }) => {
  const icons = {
    location: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
    link: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    calendar: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  };

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
      <span style={{ color: theme.foreground, opacity: 0.7 }}>{icons[icon]}</span>
      {text}
    </span>
  );
};

// =============================================================================
// Helper Components
// =============================================================================

const StatItem: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <div>
    <div
      style={{
        fontSize: highlight ? fontSize['2xl'] : fontSize.xl,
        fontWeight: fontWeight.bold,
        color: highlight ? theme.success : theme.foreground,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontSize: fontSize.xs,
        color: theme.mutedForeground,
        marginTop: 2,
      }}
    >
      {label}
    </div>
  </div>
);

const GitHubIcon: React.FC = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill={theme.foreground}>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const PRStatusIcon: React.FC<{ merged: boolean }> = ({ merged }) => (
  <div
    style={{
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: merged ? 'rgba(139, 92, 246, 0.15)' : themeAlpha.success10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    {merged ? (
      <svg width={20} height={20} viewBox="0 0 16 16" fill="#a78bfa">
        <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218zM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM5 3.25a.75.75 0 1 0 0 .005V3.25z" />
      </svg>
    ) : (
      <svg width={20} height={20} viewBox="0 0 16 16" fill={theme.success}>
        <path d="M7.177 3.073L9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zM11 2.5h-1V4h1a1 1 0 0 1 1 1v5.628a2.251 2.251 0 1 0 1.5 0V5A2.5 2.5 0 0 0 11 2.5zm1 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM3.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
      </svg>
    )}
  </div>
);
