import { getRepoBountiesWithSubmissions } from '@/db/queries/bounties';
import { fetchGitHubRepo } from '@/lib/github';
import { colors, formatAmount, getFontOptions, twitterSize, truncate } from '@/lib/og/shared';
import { ImageResponse } from 'next/og';

export const alt = 'Repository on GRIP';
export const size = twitterSize;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const fonts = await getFontOptions();

  const githubRepo = await fetchGitHubRepo(owner, repo);

  if (!githubRepo || githubRepo.private) {
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
          <div style={{ fontSize: 48, fontWeight: 700 }}>Repository Not Found</div>
        </div>
      ),
      { ...size, fonts }
    );
  }

  const bounties = await getRepoBountiesWithSubmissions(BigInt(githubRepo.id));
  const openBounties = bounties.filter((b) => b.status === 'open');
  const totalFunded = bounties.reduce((sum, b) => sum + BigInt(b.totalFunded), BigInt(0));

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
        {/* Header: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
              <rect width="24" height="24" rx="4" fill={colors.text} />
              <path d="M7 8h10M7 12h6M7 16h8" stroke={colors.background} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>GRIP</span>
          </div>
          <div style={{ fontSize: 18, color: colors.textSubtle }}>usegrip.xyz</div>
        </div>

        {/* Repo section */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 40, marginTop: 32 }}>
          <img
            src={githubRepo.owner.avatar_url}
            alt={`${owner} avatar`}
            width={120}
            height={120}
            style={{ borderRadius: 14, border: `3px solid ${colors.border}` }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 20, color: colors.textMuted }}>{owner}</span>
              <span style={{ fontSize: 44, fontWeight: 700, color: colors.text }}>{truncate(repo, 25)}</span>
            </div>

            {githubRepo.description && (
              <div style={{ fontSize: 20, color: colors.textSubtle, marginTop: 4 }}>
                {truncate(githubRepo.description, 80)}
              </div>
            )}

            {bounties.length > 0 && (
              <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
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
                  <span style={{ fontSize: 24, fontWeight: 700, color: colors.lime }}>{openBounties.length}</span>
                  <span style={{ fontSize: 18, color: colors.lime }}>
                    {openBounties.length === 1 ? 'open bounty' : 'open bounties'}
                  </span>
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
                  <span style={{ fontSize: 24, fontWeight: 700, color: colors.blue }}>{formatAmount(totalFunded)}</span>
                  <span style={{ fontSize: 18, color: colors.blue }}>total funded</span>
                </div>
              </div>
            )}

            {bounties.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 16, color: colors.textSubtle, fontSize: 18 }}>
                <span>No bounties yet · Fund your first issue on GRIP</span>
              </div>
            )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: colors.textSubtle, fontSize: 16 }}>
            {githubRepo.stargazers_count > 0 && <span>⭐ {githubRepo.stargazers_count.toLocaleString()}</span>}
            {githubRepo.language && <span>· {githubRepo.language}</span>}
          </div>
          <span style={{ fontSize: 16, color: colors.textSubtle }}>Git Reward & Incentive Platform</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
