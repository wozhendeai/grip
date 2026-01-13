# Remotion Feature Videos Prompt

Use this prompt to build Remotion compositions that showcase GRIP's key features. These videos will be embedded on the home page to replace placeholder content.

---

## Prompt

<context>
GRIP is a GitHub bounty platform where:
1. Maintainers fund GitHub issues with USD stablecoins
2. Contributors submit PRs and get paid automatically when merged
3. Payments happen on Tempo blockchain with passkey wallets (no seed phrases)

The home page currently has an interactive "UnifiedWorkflow" section with 3 steps that auto-rotate. Each step needs a corresponding video that shows the ACTUAL UI being used, not abstract animations.

The videos will loop in the visualizer panel (right column) and should feel like screen recordings of real usage, but rendered programmatically for crisp quality.
</context>

<goal>
Create 3 Remotion compositions that simulate real user interactions with GRIP's UI. Each video should:
- Use the exact UI components from the codebase (shadcn/ui, tailwind styles)
- Show realistic data (usernames, repo names, dollar amounts)
- Animate interactions (clicks, typing, transitions) smoothly
- Loop seamlessly for continuous playback on the home page
- Match the dark theme of the app
</goal>

<resume_context>
These videos support job application talking points:
1. "Built a GitHub bounty platform that triggers USD token payouts on merged PRs; implemented webhook ingestion, signature verification, and replay-safe processing"
2. "Implemented passkey wallet onboarding (WebAuthn) and transaction signing using a custom built better-auth plugin"
3. "Integrated server-side signing via Turnkey HSM with scoped spending limits to support automated weekly batch payouts"
</resume_context>

<compositions>

<composition id="FundBounty">
<title>Attach bounties instantly</title>
<description>Shows a maintainer funding a GitHub issue</description>
<flow>
1. Show the bounty creation modal/page
2. GitHub issue is selected (e.g., "Add dark mode support #142")
3. User types a bounty amount (e.g., "$250")
4. Token selector shows "PathUSD"
5. User clicks "Fund Bounty" button
6. Loading state → Success state
7. Show the bounty card as it appears on the issue
</flow>
<ui_components_to_use>
- BountyCard component from components/bounty/bounty-card.tsx
- Button, Input from components/ui/
- The actual form fields from the bounty creation flow
- Token selector component
</ui_components_to_use>
<duration>8-10 seconds, loopable</duration>
</composition>

<composition id="PasskeyWallet">
<title>Trustless Settlement</title>
<description>Shows passkey wallet creation and transaction signing</description>
<flow>
1. Show "Create Wallet" button
2. User clicks → WebAuthn prompt appears (simulate Touch ID / Face ID prompt)
3. Biometric animation (fingerprint ripple or face scan)
4. Success: Wallet address appears (e.g., "0x7a3F...8b2E")
5. Transition to signing a transaction
6. Show transaction details (payout amount, recipient)
7. Quick biometric confirmation
8. Transaction confirmed with hash
</flow>
<ui_components_to_use>
- PasskeyPrompt or wallet creation UI
- Button states (loading, success)
- Transaction confirmation modal
- Toast notifications
</ui_components_to_use>
<duration>10-12 seconds, loopable</duration>
</composition>

<composition id="AutoPayout">
<title>Reputation Building</title>
<description>Shows automated batch payout after PR merge</description>
<flow>
1. Show GitHub PR being merged (simulate GitHub UI or show webhook received)
2. Notification: "PR #105 merged"
3. Show the bounty status changing to "Processing"
4. Display batch queue (if multiple payouts pending)
5. Payout executes: amount + recipient shown
6. Status: "Paid" with transaction link
7. Contributor's profile showing updated earnings/reputation
</flow>
<ui_components_to_use>
- Bounty status badges
- Activity feed component
- User profile card with stats
- Transaction receipt UI
</ui_components_to_use>
<duration>10-12 seconds, loopable</duration>
</composition>

</compositions>

<technical_requirements>
- Resolution: 1920x1080 (will be scaled down for home page)
- FPS: 30
- Format: MP4 or WebM for web embedding
- All animations should use Remotion's spring() and interpolate() for smooth easing
- Colors must match the app's CSS variables (use tailwind classes or extract values)
- Fonts: Match the app (SF Pro Display / system font stack)
</technical_requirements>

<implementation_steps>
1. First, READ the actual UI components you'll be recreating:
   - app/(main)/[owner]/[repo]/bounties/new/ (bounty creation)
   - components/bounty/bounty-card.tsx
   - components/ui/ (buttons, inputs, cards, badges)
   - app/(main)/settings/wallet/ (wallet UI)
   - Any passkey/auth components

2. Extract the exact styles, colors, and layout patterns

3. Create shared Remotion components that mirror the real UI:
   - _remotion/components/MockBountyCard.tsx
   - _remotion/components/MockButton.tsx (with click animations)
   - _remotion/components/MockInput.tsx (with typing animations)
   - etc.

4. Build each composition using these mock components with Remotion animations

5. Add cursor animations to simulate user interactions

6. Test loops by ensuring first and last frames can connect smoothly
</implementation_steps>

<examples>
<example name="typing_animation">
// Simulating user typing in an input
const typedText = "250";
const charsToShow = Math.floor(interpolate(frame, [30, 60], [0, typedText.length], { extrapolateRight: 'clamp' }));
const displayText = typedText.slice(0, charsToShow);
</example>

<example name="button_click">
// Button press animation
const isPressed = frame >= 90 && frame < 95;
const scale = isPressed ? 0.97 : 1;
const opacity = spring({ frame: frame - 90, fps, config: { damping: 15 } });
</example>

<example name="cursor_movement">
// Animated cursor moving to button
const cursorX = interpolate(frame, [0, 30], [startX, buttonX], { easing: Easing.inOut(Easing.ease) });
const cursorY = interpolate(frame, [0, 30], [startY, buttonY], { easing: Easing.inOut(Easing.ease) });
</example>
</examples>

<output_structure>
_remotion/
├── index.ts (entry point)
├── Root.tsx (composition registry)
├── remotion.config.ts (config)
├── components/
│   ├── MockUI.tsx (shared mock components matching real UI)
│   ├── Cursor.tsx (animated cursor for interactions)
│   └── transitions.ts (shared animation helpers)
└── compositions/
    ├── FundBounty.tsx
    ├── PasskeyWallet.tsx
    └── AutoPayout.tsx
</output_structure>

---

## Before Starting

Ask yourself:
1. Have I read the actual UI components I'm recreating?
2. Do the mock components match the real styling exactly?
3. Will the video loop smoothly?
4. Does this show the feature in a way that supports the resume bullet point?
