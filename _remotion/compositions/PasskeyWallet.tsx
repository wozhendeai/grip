import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';
import {
  theme,
  themeAlpha,
  radius,
  spacing,
  fontSize,
  fontWeight,
  fadeIn,
  slideIn,
} from '../components/transitions';
import {
  Button,
  Card,
  CheckIcon,
  Spinner,
  TouchIDDialog,
  AddressDisplay,
  TransactionCard,
} from '../components/MockUI';
import { AnimatedCursor } from '../components/Cursor';

// Timeline (frames at 30fps) - 12 seconds = 360 frames
// Adjusted to give more time for Touch ID prompt to be readable
const TIMELINE = {
  START: 0,
  BUTTON_HOVER: 20,        // 0.67s
  BUTTON_CLICK: 40,        // 1.33s
  BIOMETRIC_SHOW: 50,      // 1.67s - WebAuthn prompt appears
  BIOMETRIC_SUCCESS: 130,  // 4.33s - Success (prompt: 40 frames, scan: 40 frames)
  WALLET_SHOW: 150,        // 5s - Wallet address appears
  TRANSITION_TX: 180,      // 6s - Transition to tx signing
  TX_DETAILS: 200,         // 6.67s - Show tx details
  TX_SIGN_MOVE: 230,       // 7.67s - Move to sign button
  TX_SIGN_CLICK: 250,      // 8.33s - Click sign
  TX_BIOMETRIC: 260,       // 8.67s - Quick biometric (user already authenticated)
  TX_BIOMETRIC_SUCCESS: 300, // 10s - Success
  TX_CONFIRMED: 320,       // 10.67s - Transaction confirmed
  LOOP_POINT: 360,         // 12s
};

export const PasskeyWallet: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase calculations
  const phase = getPhase(frame);
  const isButtonPressed = frame >= TIMELINE.BUTTON_CLICK && frame < TIMELINE.BUTTON_CLICK + 5;
  const isTxSignPressed = frame >= TIMELINE.TX_SIGN_CLICK && frame < TIMELINE.TX_SIGN_CLICK + 5;

  // Cursor path - only visible when there's something to click
  // Hidden during biometric prompts, success states, and transitions
  // Button Y position: card is scaled 2x, button at bottom of card = ~y:800
  const cursorPath = [
    { x: 800, y: 400, frame: 0, visible: false },           // Hidden at start
    { x: 800, y: 400, frame: TIMELINE.BUTTON_HOVER - 20, visible: true }, // Appear before button
    { x: 960, y: 800, frame: TIMELINE.BUTTON_HOVER },       // Move to "Create Wallet" button
    { x: 960, y: 800, frame: TIMELINE.BUTTON_CLICK, click: true },
    { x: 960, y: 800, frame: TIMELINE.BUTTON_CLICK + 5, visible: false }, // Hide after click
    { x: 800, y: 400, frame: TIMELINE.TX_SIGN_MOVE - 20, visible: true }, // Reappear before tx sign
    { x: 960, y: 800, frame: TIMELINE.TX_SIGN_MOVE },       // Move to "Sign with Passkey" button
    { x: 960, y: 800, frame: TIMELINE.TX_SIGN_CLICK, click: true },
    { x: 960, y: 800, frame: TIMELINE.TX_SIGN_CLICK + 5, visible: false }, // Hide after click
  ];

  // Scene transitions
  const walletCreationOpacity = phase === 'wallet-creation' || phase === 'biometric' || phase === 'wallet-success'
    ? 1
    : fadeIn(frame, TIMELINE.START, 15) * (1 - fadeIn(frame, TIMELINE.TRANSITION_TX, 20));

  const txSigningOpacity = phase === 'tx-signing' || phase === 'tx-biometric' || phase === 'tx-confirmed'
    ? fadeIn(frame, TIMELINE.TRANSITION_TX, 20)
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Center container */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          transform: 'scale(2)',
        }}
      >
        {/* Wallet Creation Scene */}
        {walletCreationOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              opacity: walletCreationOpacity,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing[6],
            }}
          >
            {phase === 'wallet-creation' && (
              <WalletCreationUI
                frame={frame}
                isButtonPressed={isButtonPressed}
              />
            )}

            {phase === 'biometric' && (
              <BiometricScene
                frame={frame}
                startFrame={TIMELINE.BIOMETRIC_SHOW}
                successFrame={TIMELINE.BIOMETRIC_SUCCESS}
              />
            )}

            {phase === 'wallet-success' && (
              <WalletSuccessUI frame={frame} />
            )}
          </div>
        )}

        {/* Transaction Signing Scene */}
        {txSigningOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              opacity: txSigningOpacity,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing[6],
            }}
          >
            {phase === 'tx-signing' && (
              <TransactionSigningUI
                frame={frame}
                isButtonPressed={isTxSignPressed}
              />
            )}

            {phase === 'tx-biometric' && (
              <BiometricScene
                frame={frame}
                startFrame={TIMELINE.TX_BIOMETRIC}
                successFrame={TIMELINE.TX_BIOMETRIC_SUCCESS}
                compact
              />
            )}

            {phase === 'tx-confirmed' && (
              <TransactionConfirmedUI frame={frame} />
            )}
          </div>
        )}
      </div>

      {/* Animated Cursor */}
      <AnimatedCursor path={cursorPath} />
    </AbsoluteFill>
  );
};

// Phase helper
function getPhase(frame: number): string {
  if (frame < TIMELINE.BIOMETRIC_SHOW) return 'wallet-creation';
  if (frame < TIMELINE.BIOMETRIC_SUCCESS + 20) return 'biometric'; // Include success animation
  if (frame < TIMELINE.TRANSITION_TX) return 'wallet-success';
  if (frame < TIMELINE.TX_BIOMETRIC) return 'tx-signing';
  if (frame < TIMELINE.TX_BIOMETRIC_SUCCESS + 20) return 'tx-biometric'; // Include success animation
  return 'tx-confirmed';
}

// Wallet Creation UI
const WalletCreationUI: React.FC<{
  frame: number;
  isButtonPressed: boolean;
}> = ({ frame, isButtonPressed }) => {
  return (
    <Card style={{ width: 500, padding: spacing[10], textAlign: 'center' }}>
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          margin: '0 auto',
          borderRadius: radius.xl,
          backgroundColor: themeAlpha.muted30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing[6],
        }}
      >
        <svg
          width={40}
          height={40}
          viewBox="0 0 24 24"
          fill="none"
          stroke={theme.primary}
          strokeWidth={1.5}
        >
          <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
          <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
        </svg>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: theme.foreground,
          margin: 0,
          marginBottom: spacing[2],
        }}
      >
        Create Your Wallet
      </h2>

      {/* Description */}
      <p
        style={{
          fontSize: fontSize.sm,
          color: theme.mutedForeground,
          margin: 0,
          marginBottom: spacing[6],
        }}
      >
        Use your device&apos;s biometrics to create a secure passkey wallet.
        No seed phrases required.
      </p>

      {/* Features */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: spacing[4],
          marginBottom: spacing[6],
        }}
      >
        <FeatureBadge icon="🔐" text="Passkey secured" />
        <FeatureBadge icon="⚡" text="Instant setup" />
        <FeatureBadge icon="🛡️" text="Self-custody" />
      </div>

      {/* Button */}
      <Button
        variant="default"
        size="lg"
        isPressed={isButtonPressed}
        style={{ width: '100%', height: 48 }}
      >
        Create Wallet
      </Button>
    </Card>
  );
};

// Biometric Scene using macOS Touch ID Dialog
const BiometricScene: React.FC<{
  frame: number;
  startFrame: number;
  successFrame: number;
  compact?: boolean;
}> = ({ frame, startFrame, successFrame }) => {
  // Determine state based on frame
  // Show prompt for 40 frames (1.33s at 30fps) so users can read it
  const scanStartFrame = startFrame + 40;

  let state: 'prompt' | 'scanning' | 'success';
  if (frame < scanStartFrame) {
    state = 'prompt';
  } else if (frame < successFrame) {
    state = 'scanning';
  } else {
    state = 'success';
  }

  return (
    <TouchIDDialog
      state={state}
      title="Touch ID"
      subtitle="Authenticate to create wallet"
    />
  );
};

// Wallet Success UI
const WalletSuccessUI: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const anim = slideIn(frame, TIMELINE.WALLET_SHOW, fps, 'up', 20);

  return (
    <Card
      style={{
        width: 500,
        padding: spacing[10],
        textAlign: 'center',
        opacity: anim.opacity,
        transform: `translateY(${anim.y}px)`,
      }}
    >
      <CheckIcon size={64} color={theme.success} />

      <h2
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: theme.foreground,
          margin: `${spacing[4]}px 0 ${spacing[2]}px`,
        }}
      >
        Wallet Created!
      </h2>

      <p
        style={{
          fontSize: fontSize.sm,
          color: theme.mutedForeground,
          margin: `0 0 ${spacing[4]}px`,
        }}
      >
        Your passkey wallet is ready to receive funds
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <AddressDisplay
          address="0x7a3F4b2E9c1D8a5F6e7B3c2A1d4E5f6789ab8b2E"
          style={{ fontSize: fontSize.sm }}
        />
      </div>
    </Card>
  );
};

// Transaction Signing UI
const TransactionSigningUI: React.FC<{
  frame: number;
  isButtonPressed: boolean;
}> = ({ frame, isButtonPressed }) => {
  const { fps } = useVideoConfig();
  const anim = slideIn(frame, TIMELINE.TX_DETAILS, fps, 'up', 20);

  return (
    <Card
      style={{
        width: 500,
        padding: spacing[8],
        opacity: anim.opacity,
        transform: `translateY(${anim.y}px)`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[3],
          marginBottom: spacing[6],
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: themeAlpha.success10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke={theme.success}
            strokeWidth={2}
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: fontSize.lg,
              fontWeight: fontWeight.semibold,
              color: theme.foreground,
            }}
          >
            Confirm Transaction
          </div>
          <div style={{ fontSize: fontSize.xs, color: theme.mutedForeground }}>
            Review and sign with your passkey
          </div>
        </div>
      </div>

      {/* Transaction details */}
      <div
        style={{
          backgroundColor: themeAlpha.muted30,
          borderRadius: radius.lg,
          padding: spacing[4],
          marginBottom: spacing[6],
        }}
      >
        <DetailRow label="Amount" value="250.00" highlight icon="icons/pathusd.svg" />
        <DetailRow label="To" value="0x1234...5678" />
        <DetailRow label="Network" value="Tempo" />
        <DetailRow label="Fee" value="Sponsored" />
      </div>

      {/* Sign button */}
      <Button
        variant="default"
        size="lg"
        isPressed={isButtonPressed}
        style={{ width: '100%', height: 48 }}
      >
        Sign with Passkey
      </Button>
    </Card>
  );
};

// Transaction Confirmed UI
const TransactionConfirmedUI: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const anim = slideIn(frame, TIMELINE.TX_CONFIRMED, fps, 'up', 20);

  return (
    <div
      style={{
        textAlign: 'center',
        opacity: anim.opacity,
        transform: `translateY(${anim.y}px)`,
      }}
    >
      <CheckIcon size={80} color={theme.success} />

      <h2
        style={{
          fontSize: fontSize['2xl'],
          fontWeight: fontWeight.bold,
          color: theme.foreground,
          margin: `${spacing[4]}px 0 ${spacing[2]}px`,
        }}
      >
        Transaction Confirmed!
      </h2>

      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing[2],
          fontSize: fontSize.sm,
          color: theme.mutedForeground,
          marginBottom: spacing[4],
        }}
      >
        <Img
          src={staticFile('icons/pathusd.svg')}
          style={{ width: 16, height: 16, borderRadius: radius.full }}
        />
        250.00 sent successfully
      </p>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: spacing[2],
          padding: `${spacing[2]}px ${spacing[4]}px`,
          borderRadius: radius.md,
          backgroundColor: themeAlpha.muted30,
          fontSize: fontSize.xs,
          color: theme.mutedForeground,
          fontFamily: 'monospace',
        }}
      >
        0x8f3a...4b2c
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
    </div>
  );
};

// Helper components
const FeatureBadge: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing[1],
      fontSize: fontSize.xs,
      color: theme.mutedForeground,
    }}
  >
    <span>{icon}</span>
    <span>{text}</span>
  </div>
);

const DetailRow: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
  icon?: string;
}> = ({ label, value, highlight, icon }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${spacing[2]}px 0`,
      borderBottom: `1px solid ${theme.border}`,
    }}
  >
    <span style={{ fontSize: fontSize.sm, color: theme.mutedForeground }}>
      {label}
    </span>
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing[2],
        fontSize: highlight ? fontSize.lg : fontSize.sm,
        fontWeight: highlight ? fontWeight.bold : fontWeight.medium,
        color: highlight ? theme.success : theme.foreground,
        fontFamily: label === 'To' ? 'monospace' : 'inherit',
      }}
    >
      {icon && (
        <Img
          src={staticFile(icon)}
          style={{ width: 18, height: 18, borderRadius: radius.full }}
        />
      )}
      {value}
    </span>
  </div>
);
