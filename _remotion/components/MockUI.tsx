import type { CSSProperties, ReactNode } from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, Img, staticFile } from 'remotion';
import {
  theme,
  themeAlpha,
  radius,
  spacing,
  fontSize,
  fontWeight,
  spinnerRotation,
  springConfig,
} from './transitions';

// =============================================================================
// Button Component
// =============================================================================

interface ButtonProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  isPressed?: boolean;
  isLoading?: boolean;
  style?: CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'default',
  size = 'default',
  isPressed = false,
  isLoading = false,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = isPressed ? 0.97 : 1;
  const springScale = spring({
    frame,
    fps,
    config: springConfig.snappy,
    from: isPressed ? 1 : 0.97,
    to: scale,
    durationInFrames: 6,
  });

  const variants: Record<string, CSSProperties> = {
    default: {
      backgroundColor: theme.primary,
      color: theme.primaryForeground,
      border: 'none',
    },
    outline: {
      backgroundColor: 'transparent',
      color: theme.foreground,
      border: `1px solid ${theme.border}`,
    },
    secondary: {
      backgroundColor: theme.secondary,
      color: theme.secondaryForeground,
      border: 'none',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: theme.foreground,
      border: 'none',
    },
    destructive: {
      backgroundColor: theme.destructive,
      color: theme.destructiveForeground,
      border: 'none',
    },
  };

  const sizes: Record<string, CSSProperties> = {
    sm: { height: 28, padding: '0 12px', fontSize: fontSize.xs },
    default: { height: 32, padding: '0 16px', fontSize: fontSize.sm },
    lg: { height: 40, padding: '0 24px', fontSize: fontSize.base },
    icon: { height: 32, width: 32, padding: 0 },
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        borderRadius: radius.md,
        fontWeight: fontWeight.medium,
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: `scale(${springScale})`,
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
    >
      {isLoading && <Spinner size={14} />}
      {children}
    </div>
  );
};

// =============================================================================
// Input Component
// =============================================================================

interface InputProps {
  value: string;
  placeholder?: string;
  prefix?: ReactNode;
  style?: CSSProperties;
  isFocused?: boolean;
}

export const Input: React.FC<InputProps> = ({
  value,
  placeholder,
  prefix,
  style = {},
  isFocused = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        borderRadius: radius.md,
        backgroundColor: themeAlpha.muted30,
        border: `1px solid ${isFocused ? theme.primary : theme.border}`,
        padding: `0 ${spacing[3]}px`,
        boxShadow: isFocused ? `0 0 0 2px ${themeAlpha.primary20}` : 'none',
        ...style,
      }}
    >
      {prefix && (
        <span style={{ color: theme.mutedForeground, marginRight: spacing[2] }}>
          {prefix}
        </span>
      )}
      <span
        style={{
          color: value ? theme.foreground : theme.mutedForeground,
          fontSize: fontSize.sm,
          flex: 1,
        }}
      >
        {value || placeholder}
        {isFocused && (
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 18,
              backgroundColor: theme.primary,
              marginLeft: 1,
              verticalAlign: 'middle',
            }}
          />
        )}
      </span>
    </div>
  );
};

// =============================================================================
// Badge Component
// =============================================================================

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'destructive';
  style?: CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  style = {},
}) => {
  const variants: Record<string, CSSProperties> = {
    default: {
      backgroundColor: theme.primary,
      color: theme.primaryForeground,
    },
    secondary: {
      backgroundColor: themeAlpha.muted50,
      color: theme.foreground,
    },
    outline: {
      backgroundColor: 'transparent',
      color: theme.foreground,
      border: `1px solid ${theme.border}`,
    },
    success: {
      backgroundColor: themeAlpha.success10,
      color: theme.success,
      border: `1px solid ${themeAlpha.success20}`,
    },
    destructive: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      color: theme.destructive,
      border: '1px solid rgba(239, 68, 68, 0.2)',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 20,
        padding: '0 8px',
        borderRadius: radius.full,
        fontSize: 10,
        fontWeight: fontWeight.medium,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
};

// =============================================================================
// Card Component
// =============================================================================

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, style = {} }) => {
  return (
    <div
      style={{
        backgroundColor: theme.card,
        borderRadius: radius.xl,
        border: `1px solid ${theme.border}`,
        padding: spacing[6],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// =============================================================================
// Spinner Component
// =============================================================================

interface SpinnerProps {
  size?: number;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 20,
  color = theme.primary,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rotation = spinnerRotation(frame, fps);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={themeAlpha.muted30}
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
};

// =============================================================================
// CheckIcon Component
// =============================================================================

interface CheckIconProps {
  size?: number;
  color?: string;
  animated?: boolean;
}

export const CheckIcon: React.FC<CheckIconProps> = ({
  size = 24,
  color = theme.success,
  animated = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pathLength = animated
    ? spring({
        frame,
        fps,
        config: { damping: 15, stiffness: 100 },
        from: 0,
        to: 1,
      })
    : 1;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill={themeAlpha.success10} />
      <path
        d="M8 12l3 3 5-6"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={20}
        strokeDashoffset={20 * (1 - pathLength)}
      />
    </svg>
  );
};

// =============================================================================
// Avatar Component
// =============================================================================

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: number;
  style?: CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({
  fallback,
  size = 40,
  style = {},
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius.lg,
        backgroundColor: theme.muted,
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: fontWeight.semibold,
        color: theme.mutedForeground,
        ...style,
      }}
    >
      {fallback}
    </div>
  );
};

// =============================================================================
// Issue Card (for bounty creation)
// =============================================================================

interface IssueCardProps {
  number: number;
  title: string;
  labels?: Array<{ name: string; color: string }>;
  isSelected?: boolean;
  style?: CSSProperties;
}

export const IssueCard: React.FC<IssueCardProps> = ({
  number,
  title,
  labels = [],
  isSelected = false,
  style = {},
}) => {
  return (
    <div
      style={{
        padding: spacing[4],
        borderRadius: radius.lg,
        backgroundColor: isSelected ? themeAlpha.primary10 : 'transparent',
        border: `1px solid ${isSelected ? theme.primary : theme.border}`,
        cursor: 'pointer',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <Badge variant="outline">#{number}</Badge>
        <span
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: theme.foreground,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>
      {labels.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: spacing[1],
            marginTop: spacing[2],
            flexWrap: 'wrap',
          }}
        >
          {labels.slice(0, 3).map((label) => (
            <Badge
              key={label.name}
              variant="secondary"
              style={{ fontSize: 9 }}
            >
              {label.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Bounty Card Component
// =============================================================================

interface BountyCardProps {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  amount: number;
  status: 'open' | 'claimed' | 'completed';
  labels?: Array<{ name: string }>;
  style?: CSSProperties;
}

export const BountyCard: React.FC<BountyCardProps> = ({
  owner,
  issueNumber,
  title,
  amount,
  status,
  labels = [],
  style = {},
}) => {
  const statusStyles: Record<string, { bg: string; color: string; text: string }> = {
    open: { bg: themeAlpha.success10, color: theme.success, text: 'Open' },
    claimed: { bg: themeAlpha.primary10, color: theme.primary, text: 'Claimed' },
    completed: { bg: themeAlpha.muted30, color: theme.mutedForeground, text: 'Done' },
  };

  const s = statusStyles[status];

  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: spacing[4],
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Avatar fallback={owner[0].toUpperCase()} size={40} />
        <Badge
          style={{
            backgroundColor: s.bg,
            color: s.color,
            border: 'none',
          }}
        >
          {s.text}
        </Badge>
      </div>

      {/* Title */}
      <div>
        <div
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.semibold,
            color: theme.foreground,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: fontSize.xs,
            color: theme.mutedForeground,
            marginTop: spacing[1],
          }}
        >
          #{issueNumber}
        </div>
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div style={{ display: 'flex', gap: spacing[1], flexWrap: 'wrap' }}>
          {labels.slice(0, 3).map((label) => (
            <Badge key={label.name} variant="secondary">
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: status === 'completed' ? theme.mutedForeground : theme.foreground,
            textDecoration: status === 'completed' ? 'line-through' : 'none',
          }}
        >
          ${amount}
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: themeAlpha.muted30,
            border: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.mutedForeground}
            strokeWidth={2}
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Card>
  );
};

// =============================================================================
// Token Selector Component
// =============================================================================

interface TokenSelectorProps {
  token: { symbol: string; name: string };
  balance?: string;
  style?: CSSProperties;
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  token,
  balance,
  style = {},
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[3],
        padding: `${spacing[3]}px ${spacing[4]}px`,
        borderRadius: radius.md,
        backgroundColor: themeAlpha.muted30,
        border: `1px solid ${theme.border}`,
        cursor: 'pointer',
        ...style,
      }}
    >
      {/* PathUSD icon */}
      <Img
        src={staticFile('icons/pathusd.svg')}
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.semibold,
            color: theme.foreground,
          }}
        >
          {token.symbol}
        </div>
        <div style={{ fontSize: fontSize.xs, color: theme.mutedForeground }}>
          {token.name}
        </div>
      </div>
      {balance && (
        <div
          style={{
            fontSize: fontSize.sm,
            color: theme.mutedForeground,
          }}
        >
          {balance}
        </div>
      )}
      {/* Dropdown chevron */}
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke={theme.mutedForeground}
        strokeWidth={2}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
};

// =============================================================================
// Biometric Prompt Component
// =============================================================================

interface BiometricPromptProps {
  type?: 'fingerprint' | 'face';
  isScanning?: boolean;
  isSuccess?: boolean;
  style?: CSSProperties;
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  type = 'fingerprint',
  isScanning = false,
  isSuccess = false,
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulsing animation for scanning state
  const pulseScale = isScanning
    ? 1 + 0.1 * Math.sin((frame / fps) * Math.PI * 2)
    : 1;
  const pulseOpacity = isScanning
    ? 0.5 + 0.3 * Math.sin((frame / fps) * Math.PI * 2)
    : 0;

  const color = isSuccess ? theme.success : theme.primary;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[4],
        ...style,
      }}
    >
      {/* Biometric icon with pulse */}
      <div style={{ position: 'relative' }}>
        {/* Pulse ring */}
        {isScanning && (
          <div
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: radius.full,
              border: `2px solid ${color}`,
              opacity: pulseOpacity,
              transform: `scale(${pulseScale})`,
            }}
          />
        )}

        {/* Icon container */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            backgroundColor: isSuccess ? themeAlpha.success10 : themeAlpha.muted30,
            border: `2px solid ${isSuccess ? theme.success : theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isSuccess ? (
            <CheckIcon size={40} color={theme.success} />
          ) : type === 'fingerprint' ? (
            <svg
              width={40}
              height={40}
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth={1.5}
            >
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
              <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
              <path d="M2 12a10 10 0 0 1 18-6" />
              <path d="M2 16h.01" />
              <path d="M21.8 16c.2-2 .131-5.354 0-6" />
              <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
              <path d="M8.65 22c.21-.66.45-1.32.57-2" />
              <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
            </svg>
          ) : (
            <svg
              width={40}
              height={40}
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth={1.5}
            >
              <path d="M9 10h.01" />
              <path d="M15 10h.01" />
              <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8Z" />
            </svg>
          )}
        </div>
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: fontSize.base,
            fontWeight: fontWeight.medium,
            color: theme.foreground,
          }}
        >
          {isSuccess
            ? 'Verified!'
            : isScanning
              ? 'Scanning...'
              : type === 'fingerprint'
                ? 'Touch ID'
                : 'Face ID'}
        </div>
        {!isSuccess && (
          <div
            style={{
              fontSize: fontSize.sm,
              color: theme.mutedForeground,
              marginTop: spacing[1],
            }}
          >
            {isScanning
              ? 'Keep your finger on the sensor'
              : 'Use biometrics to continue'}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Transaction Card Component
// =============================================================================

interface TransactionCardProps {
  type: 'send' | 'receive';
  amount: number;
  recipient?: string;
  sender?: string;
  status: 'pending' | 'confirmed' | 'failed';
  hash?: string;
  style?: CSSProperties;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  type,
  amount,
  recipient,
  sender,
  status,
  hash,
  style = {},
}) => {
  const statusStyles: Record<string, { color: string; text: string }> = {
    pending: { color: theme.mutedForeground, text: 'Pending' },
    confirmed: { color: theme.success, text: 'Confirmed' },
    failed: { color: theme.destructive, text: 'Failed' },
  };

  const s = statusStyles[status];

  return (
    <Card style={{ ...style }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[4],
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            backgroundColor:
              type === 'receive' ? themeAlpha.success10 : themeAlpha.muted30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke={type === 'receive' ? theme.success : theme.foreground}
            strokeWidth={2}
            style={{
              transform: type === 'receive' ? 'rotate(180deg)' : 'none',
            }}
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </div>

        {/* Details */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: theme.foreground,
            }}
          >
            {type === 'receive' ? 'Received' : 'Sent'}
          </div>
          <div
            style={{
              fontSize: fontSize.xs,
              color: theme.mutedForeground,
            }}
          >
            {type === 'receive'
              ? `From ${sender?.slice(0, 8)}...`
              : `To ${recipient?.slice(0, 8)}...`}
          </div>
        </div>

        {/* Amount and status */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.bold,
              color: type === 'receive' ? theme.success : theme.foreground,
            }}
          >
            {type === 'receive' ? '+' : '-'}${amount}
          </div>
          <div style={{ fontSize: fontSize.xs, color: s.color }}>{s.text}</div>
        </div>
      </div>

      {hash && (
        <div
          style={{
            marginTop: spacing[3],
            paddingTop: spacing[3],
            borderTop: `1px solid ${theme.border}`,
            fontSize: fontSize.xs,
            color: theme.mutedForeground,
            fontFamily: 'monospace',
          }}
        >
          {hash.slice(0, 20)}...{hash.slice(-8)}
        </div>
      )}
    </Card>
  );
};

// =============================================================================
// GitHub PR Card Component
// =============================================================================

interface PRCardProps {
  number: number;
  title: string;
  author: string;
  status: 'open' | 'merged' | 'closed';
  style?: CSSProperties;
}

export const PRCard: React.FC<PRCardProps> = ({
  number,
  title,
  author,
  status,
  style = {},
}) => {
  const statusStyles: Record<string, { bg: string; color: string; icon: ReactNode }> = {
    open: {
      bg: themeAlpha.success10,
      color: theme.success,
      icon: (
        <svg width={16} height={16} viewBox="0 0 16 16" fill={theme.success}>
          <path d="M7.177 3.073L9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25zM11 2.5h-1V4h1a1 1 0 0 1 1 1v5.628a2.251 2.251 0 1 0 1.5 0V5A2.5 2.5 0 0 0 11 2.5zm1 10.25a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM3.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z" />
        </svg>
      ),
    },
    merged: {
      bg: 'rgba(139, 92, 246, 0.1)',
      color: '#8b5cf6',
      icon: (
        <svg width={16} height={16} viewBox="0 0 16 16" fill="#8b5cf6">
          <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218zM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM5 3.25a.75.75 0 1 0 0 .005V3.25z" />
        </svg>
      ),
    },
    closed: {
      bg: 'rgba(239, 68, 68, 0.1)',
      color: theme.destructive,
      icon: (
        <svg width={16} height={16} viewBox="0 0 16 16" fill={theme.destructive}>
          <path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1zm9.5 5h1.378a2.251 2.251 0 1 1 0 1.5H12.75A5.75 5.75 0 0 1 7 1.5h1.5A4.25 4.25 0 0 0 12.75 6zM4 12.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0zm8.75-5.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM3.25 4a.75.75 0 1 0 0-.005V4z" />
        </svg>
      ),
    },
  };

  const s = statusStyles[status];

  return (
    <Card style={{ padding: spacing[4], ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing[3] }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.md,
            backgroundColor: s.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {s.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: fontSize.sm,
              fontWeight: fontWeight.semibold,
              color: theme.foreground,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: fontSize.xs,
              color: theme.mutedForeground,
              marginTop: 2,
            }}
          >
            #{number} by {author}
          </div>
        </div>
        <Badge
          style={{
            backgroundColor: s.bg,
            color: s.color,
            border: 'none',
            textTransform: 'capitalize',
          }}
        >
          {status}
        </Badge>
      </div>
    </Card>
  );
};

// =============================================================================
// Wallet Address Display
// =============================================================================

interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  style?: CSSProperties;
}

export const AddressDisplay: React.FC<AddressDisplayProps> = ({
  address,
  truncate = true,
  style = {},
}) => {
  const displayAddress = truncate
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[2],
        padding: `${spacing[1]}px ${spacing[2]}px`,
        borderRadius: radius.md,
        backgroundColor: themeAlpha.muted30,
        fontFamily: 'monospace',
        fontSize: fontSize.xs,
        color: theme.mutedForeground,
        ...style,
      }}
    >
      {displayAddress}
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </div>
  );
};

// =============================================================================
// Activity Feed Item
// =============================================================================

interface ActivityItemProps {
  icon: ReactNode;
  title: string;
  description: string;
  time: string;
  style?: CSSProperties;
}

export const ActivityItem: React.FC<ActivityItemProps> = ({
  icon,
  title,
  description,
  time,
  style = {},
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing[3],
        padding: spacing[3],
        ...style,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: themeAlpha.muted30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: theme.foreground,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: fontSize.xs,
            color: theme.mutedForeground,
            marginTop: 2,
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          fontSize: fontSize.xs,
          color: theme.mutedForeground,
          flexShrink: 0,
        }}
      >
        {time}
      </div>
    </div>
  );
};

// =============================================================================
// macOS Touch ID Dialog Component
// =============================================================================

interface TouchIDDialogProps {
  state: 'prompt' | 'scanning' | 'success' | 'error';
  title?: string;
  subtitle?: string;
  style?: CSSProperties;
}

export const TouchIDDialog: React.FC<TouchIDDialogProps> = ({
  state,
  title = 'Touch ID',
  subtitle = 'Touch the sensor to continue',
  style = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse animation for scanning state
  const scanPulse = state === 'scanning'
    ? 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 3)
    : 0;

  // Ring expansion for scanning
  const ringScale = state === 'scanning'
    ? 1 + 0.3 * ((frame / fps * 2) % 1)
    : 1;
  const ringOpacity = state === 'scanning'
    ? 0.6 * (1 - ((frame / fps * 2) % 1))
    : 0;

  // Success checkmark animation
  const checkProgress = state === 'success'
    ? spring({ frame, fps, config: { damping: 12, stiffness: 100, mass: 1, overshootClamping: false } })
    : 0;

  // Colors based on state
  const iconColor = {
    prompt: '#ff6b6b',      // Coral red for fingerprint
    scanning: '#007AFF',    // Apple blue
    success: '#34C759',     // Apple green
    error: '#FF3B30',       // Apple red
  }[state];

  const subtitleText = {
    prompt: subtitle,
    scanning: 'Scanning...',
    success: 'Success',
    error: 'Try again',
  }[state];

  const subtitleColor = {
    prompt: theme.mutedForeground,
    scanning: '#007AFF',
    success: '#34C759',
    error: '#FF3B30',
  }[state];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...style,
      }}
    >
      {/* macOS-style dialog card */}
      <div
        style={{
          width: 280,
          backgroundColor: 'rgba(40, 40, 45, 0.95)',
          backdropFilter: 'blur(40px)',
          borderRadius: 14,
          padding: '28px 24px 20px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Icon container with pulse rings */}
        <div style={{ position: 'relative', width: 64, height: 64 }}>
          {/* Scanning pulse rings */}
          {state === 'scanning' && (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: -10,
                  borderRadius: '50%',
                  border: `2px solid ${iconColor}`,
                  opacity: ringOpacity,
                  transform: `scale(${ringScale})`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: -5,
                  borderRadius: '50%',
                  border: `2px solid ${iconColor}`,
                  opacity: ringOpacity * 0.7,
                  transform: `scale(${1 + (ringScale - 1) * 0.5})`,
                }}
              />
            </>
          )}

          {/* Icon background circle */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: state === 'success'
                ? 'rgba(52, 199, 89, 0.15)'
                : state === 'scanning'
                  ? `rgba(0, 122, 255, ${0.1 + scanPulse * 0.1})`
                  : 'rgba(255, 107, 107, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.3s',
            }}
          >
            {state === 'success' ? (
              // Checkmark icon
              <svg width={32} height={32} viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke={iconColor}
                  strokeWidth="2"
                  strokeDasharray={63}
                  strokeDashoffset={63 * (1 - checkProgress)}
                />
                <path
                  d="M8 12l3 3 5-6"
                  fill="none"
                  stroke={iconColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={20}
                  strokeDashoffset={20 * (1 - Math.max(0, (checkProgress - 0.5) * 2))}
                />
              </svg>
            ) : (
              // Fingerprint icon
              <svg
                width={36}
                height={36}
                viewBox="0 0 24 24"
                fill="none"
                stroke={iconColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{
                  opacity: state === 'scanning' ? 0.8 + scanPulse * 0.2 : 1,
                }}
              >
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                <path d="M2 12a10 10 0 0 1 18-6" />
                <path d="M2 16h.01" />
                <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
              </svg>
            )}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#ffffff',
            textAlign: 'center',
          }}
        >
          {state === 'success' ? 'Success' : title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 13,
            color: subtitleColor,
            textAlign: 'center',
            marginTop: -8,
          }}
        >
          {subtitleText}
        </div>

        {/* Buttons (only show in prompt state) */}
        {state === 'prompt' && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 8,
              width: '100%',
            }}
          >
            <MacOSButton variant="secondary">Cancel</MacOSButton>
            <MacOSButton variant="secondary">Use Password...</MacOSButton>
          </div>
        )}
      </div>
    </div>
  );
};

// macOS-style button for the dialog
const MacOSButton: React.FC<{
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}> = ({ children, variant = 'secondary' }) => (
  <div
    style={{
      flex: 1,
      padding: '6px 12px',
      borderRadius: 6,
      backgroundColor: variant === 'primary' ? '#007AFF' : 'rgba(255, 255, 255, 0.1)',
      color: variant === 'primary' ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
      fontSize: 13,
      fontWeight: 500,
      textAlign: 'center',
      cursor: 'pointer',
    }}
  >
    {children}
  </div>
);
