import { colors, getFontOptions, twitterSize } from '@/lib/og/shared';
import { ImageResponse } from 'next/og';

export const alt = 'GRIP - Git Reward & Incentive Platform';
export const size = twitterSize;
export const contentType = 'image/png';

export default async function Image() {
  const fonts = await getFontOptions();

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: colors.background,
          padding: 48,
          fontFamily: 'Noto Sans',
        }}
      >
        {/* Logo and Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
            <rect width="24" height="24" rx="4" fill={colors.text} />
            <path
              d="M7 8h10M7 12h6M7 16h8"
              stroke={colors.background}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 800, color: colors.text, letterSpacing: '-0.02em' }}>
            GRIP
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: colors.textMuted,
            marginTop: 24,
            textAlign: 'center',
          }}
        >
          Git Reward & Incentive Platform
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 20,
            color: colors.textSubtle,
            marginTop: 20,
            textAlign: 'center',
            maxWidth: 700,
          }}
        >
          Enterprise reward infrastructure for GitHub contributions.
          Pay contributors instantly with blockchain-backed bounties.
        </div>

        {/* Features */}
        <div style={{ display: 'flex', gap: 36, marginTop: 36 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: `${colors.lime}20`,
              border: `1px solid ${colors.lime}40`,
              borderRadius: 10,
              padding: '10px 20px',
            }}
          >
            <span style={{ fontSize: 20 }}>💰</span>
            <span style={{ fontSize: 18, color: colors.lime }}>Fund Issues</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: `${colors.blue}20`,
              border: `1px solid ${colors.blue}40`,
              borderRadius: 10,
              padding: '10px 20px',
            }}
          >
            <span style={{ fontSize: 20 }}>🔐</span>
            <span style={{ fontSize: 18, color: colors.blue }}>Passkey Wallets</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              backgroundColor: `${colors.purple}20`,
              border: `1px solid ${colors.purple}40`,
              borderRadius: 10,
              padding: '10px 20px',
            }}
          >
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontSize: 18, color: colors.purple }}>Instant Payouts</span>
          </div>
        </div>

        {/* URL */}
        <div style={{ fontSize: 18, color: colors.textSubtle, marginTop: 36 }}>usegrip.xyz</div>
      </div>
    ),
    { ...size, fonts }
  );
}
