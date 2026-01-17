import { getBountyWithAuthor } from '@/db/queries/bounties';
import {
  capitalize,
  colors,
  formatAmount,
  getFontOptions,
  getStatusColor,
  twitterSize,
  truncate,
} from '@/lib/og/shared';
import { ImageResponse } from 'next/og';

export const alt = 'Bounty on GRIP';
export const size = twitterSize;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string; id: string }> }) {
  const { owner, repo, id } = await params;
  const result = await getBountyWithAuthor(id);

  const fonts = await getFontOptions();

  if (!result || result.bounty.githubOwner !== owner || result.bounty.githubRepo !== repo) {
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
            color: colors.text,
            fontFamily: 'Noto Sans',
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700 }}>Bounty Not Found</div>
        </div>
      ),
      { ...size, fonts }
    );
  }

  const { bounty } = result;
  const statusColor = getStatusColor(bounty.status);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          backgroundColor: colors.background,
          padding: 48,
          fontFamily: 'Noto Sans',
        }}
      >
        {/* Header: Logo and Repo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
              <rect width="24" height="24" rx="4" fill={colors.text} />
              <path d="M7 8h10M7 12h6M7 16h8" stroke={colors.background} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.text }}>GRIP</span>
          </div>
          <div style={{ fontSize: 22, color: colors.textMuted }}>
            {owner}/{repo}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 20 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: colors.text, lineHeight: 1.2 }}>
            {truncate(bounty.title, 70)}
          </div>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: `${colors.lime}20`,
                border: `1px solid ${colors.lime}40`,
                borderRadius: 10,
                padding: '10px 20px',
              }}
            >
              <span style={{ fontSize: 28 }}>💰</span>
              <span style={{ fontSize: 28, fontWeight: 600, color: colors.lime }}>
                {formatAmount(bounty.totalFunded)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: `${statusColor}20`,
                border: `1px solid ${statusColor}50`,
                borderRadius: 10,
                padding: '10px 20px',
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 600, color: statusColor }}>
                {capitalize(bounty.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: `1px solid ${colors.border}`,
            paddingTop: 20,
          }}
        >
          <div style={{ fontSize: 18, color: colors.textSubtle }}>usegrip.xyz</div>
          <div style={{ fontSize: 18, color: colors.textSubtle }}>Git Reward & Incentive Platform</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
