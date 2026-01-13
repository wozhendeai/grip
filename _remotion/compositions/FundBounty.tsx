import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence, Img, staticFile } from 'remotion';
import {
  theme,
  themeAlpha,
  radius,
  spacing,
  fontSize,
  fontWeight,
  typedText,
  fadeIn,
  slideIn,
  springConfig,
} from '../components/transitions';
import {
  Button,
  Input,
  Badge,
  Card,
  IssueCard,
  BountyCard,
  TokenSelector,
  CheckIcon,
  Spinner,
} from '../components/MockUI';
import { AnimatedCursor } from '../components/Cursor';

// Timeline constants (in frames at 30fps)
const TIMELINE = {
  START: 0,
  ISSUE_SELECT: 30,      // 1s - Cursor moves to issue
  ISSUE_CLICK: 50,       // 1.67s - Click on issue
  AMOUNT_FOCUS: 80,      // 2.67s - Move to amount input
  AMOUNT_TYPE_START: 100, // 3.33s - Start typing
  AMOUNT_TYPE_END: 140,   // 4.67s - Finish typing
  TOKEN_SHOW: 150,        // 5s - Token selector visible
  BUTTON_MOVE: 170,       // 5.67s - Move to button
  BUTTON_CLICK: 190,      // 6.33s - Click fund button
  LOADING: 195,           // 6.5s - Loading state
  SUCCESS: 230,           // 7.67s - Success state
  CARD_APPEAR: 250,       // 8.33s - Bounty card appears
  LOOP_RESET: 300,        // 10s - Loop point
};

export const FundBounty: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // State calculations based on frame
  const isIssueSelected = frame >= TIMELINE.ISSUE_CLICK + 5;
  const isAmountFocused = frame >= TIMELINE.AMOUNT_FOCUS && frame < TIMELINE.BUTTON_MOVE;
  const amountValue = typedText(frame, TIMELINE.AMOUNT_TYPE_START, '250', 8, fps);
  const isButtonPressed = frame >= TIMELINE.BUTTON_CLICK && frame < TIMELINE.BUTTON_CLICK + 5;
  const isLoading = frame >= TIMELINE.LOADING && frame < TIMELINE.SUCCESS;
  const isSuccess = frame >= TIMELINE.SUCCESS;
  const showBountyCard = frame >= TIMELINE.CARD_APPEAR;

  // Cursor path - only visible when interacting with elements
  // Card is 900px wide centered on 1920x1080: left edge at 510, padding 32px
  // Left column center ~751, Right column center ~1201
  const cursorPath = [
    { x: 600, y: 350, frame: 0, visible: false },           // Hidden at start
    { x: 600, y: 350, frame: TIMELINE.ISSUE_SELECT - 15, visible: true }, // Appear
    { x: 751, y: 480, frame: TIMELINE.ISSUE_SELECT },       // Move to first issue card
    { x: 751, y: 480, frame: TIMELINE.ISSUE_CLICK, click: true }, // Click issue
    { x: 1201, y: 460, frame: TIMELINE.AMOUNT_FOCUS },      // Move to amount input
    { x: 1201, y: 460, frame: TIMELINE.AMOUNT_TYPE_END },   // Stay while typing
    { x: 1201, y: 640, frame: TIMELINE.BUTTON_MOVE },       // Move down to Fund button
    { x: 1201, y: 640, frame: TIMELINE.BUTTON_CLICK, click: true }, // Click button
    { x: 1201, y: 640, frame: TIMELINE.BUTTON_CLICK + 5, visible: false }, // Hide after click
  ];

  // Form opacity (fades out on success)
  const formOpacity = isSuccess
    ? interpolate(frame, [TIMELINE.SUCCESS, TIMELINE.SUCCESS + 15], [1, 0], {
        extrapolateRight: 'clamp',
      })
    : 1;

  // Success card animation
  const successAnim = slideIn(frame, TIMELINE.SUCCESS, fps, 'up', 30);

  // Bounty card animation
  const cardAnim = slideIn(frame, TIMELINE.CARD_APPEAR, fps, 'up', 40);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.background,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Main container */}
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
        {/* Form Card */}
        <div
          style={{
            opacity: formOpacity,
            display: formOpacity > 0 ? 'block' : 'none',
          }}
        >
          <Card
            style={{
              width: 900,
              padding: spacing[8],
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: spacing[6] }}>
              <h2
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: theme.foreground,
                  margin: 0,
                }}
              >
                Create Bounty
              </h2>
              <p
                style={{
                  fontSize: fontSize.sm,
                  color: theme.mutedForeground,
                  margin: `${spacing[2]}px 0 0`,
                }}
              >
                Fund a GitHub issue to incentivize contributions
              </p>
            </div>

            <div style={{ display: 'flex', gap: spacing[8] }}>
              {/* Left column - Issue selection */}
              <div style={{ flex: 1 }}>
                <Label>Select Issue</Label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing[2],
                    marginTop: spacing[2],
                  }}
                >
                  <IssueCard
                    number={142}
                    title="Add dark mode support"
                    labels={[
                      { name: 'enhancement', color: '#a2eeef' },
                      { name: 'ui', color: '#d4c5f9' },
                    ]}
                    isSelected={isIssueSelected}
                  />
                  <IssueCard
                    number={138}
                    title="Fix login redirect bug"
                    labels={[{ name: 'bug', color: '#d73a4a' }]}
                    isSelected={false}
                    style={{ opacity: 0.6 }}
                  />
                  <IssueCard
                    number={135}
                    title="Update dependencies"
                    labels={[{ name: 'dependencies', color: '#0366d6' }]}
                    isSelected={false}
                    style={{ opacity: 0.4 }}
                  />
                </div>
              </div>

              {/* Right column - Bounty details */}
              <div style={{ flex: 1 }}>
                <Label>Bounty Amount</Label>
                <Input
                  value={amountValue ? `$${amountValue}` : ''}
                  placeholder="$0.00"
                  isFocused={isAmountFocused}
                  style={{ marginTop: spacing[2], height: 48 }}
                />

                <div style={{ marginTop: spacing[4] }}>
                  <Label>Payment Token</Label>
                  <TokenSelector
                    token={{ symbol: 'PathUSD', name: 'Path USD Stablecoin' }}
                    balance="$1,234.56"
                    style={{ marginTop: spacing[2] }}
                  />
                </div>

                <div style={{ marginTop: spacing[6] }}>
                  <Button
                    variant="default"
                    size="lg"
                    isPressed={isButtonPressed}
                    isLoading={isLoading}
                    style={{
                      width: '100%',
                      height: 48,
                      fontSize: fontSize.base,
                    }}
                  >
                    {isLoading ? 'Creating...' : 'Fund Bounty'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Success State */}
        {isSuccess && !showBountyCard && (
          <div
            style={{
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: spacing[4],
              opacity: successAnim.opacity,
              transform: `translateY(${successAnim.y}px)`,
            }}
          >
            <CheckIcon size={80} color={theme.success} />
            <div
              style={{
                fontSize: fontSize['2xl'],
                fontWeight: fontWeight.bold,
                color: theme.foreground,
              }}
            >
              Bounty Created!
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[2],
                fontSize: fontSize.base,
                color: theme.mutedForeground,
              }}
            >
              <Img
                src={staticFile('icons/pathusd.svg')}
                style={{ width: 18, height: 18, borderRadius: radius.full }}
              />
              250 funded on Issue #142
            </div>
          </div>
        )}

        {/* Bounty Card Result */}
        {showBountyCard && (
          <div
            style={{
              opacity: cardAnim.opacity,
              transform: `translateY(${cardAnim.y}px)`,
            }}
          >
            <BountyCard
              owner="acme"
              repo="webapp"
              issueNumber={142}
              title="Add dark mode support"
              amount={250}
              status="open"
              labels={[{ name: 'enhancement' }, { name: 'ui' }]}
              style={{ width: 400 }}
            />
          </div>
        )}
      </div>

      {/* Animated Cursor */}
      <AnimatedCursor path={cursorPath} />
    </AbsoluteFill>
  );
};

// Helper label component
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      color: theme.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}
  >
    {children}
  </div>
);
