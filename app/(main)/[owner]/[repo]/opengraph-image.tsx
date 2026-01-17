import { getRepoBountiesWithSubmissions } from '@/db/queries/bounties';
import { fetchGitHubRepo } from '@/lib/github';
import { colors, formatAmount, getFontOptions, ogSize, truncate } from '@/lib/og/shared';
import { ImageResponse } from 'next/og';

export const alt = 'Repository on GRIP';
export const size = ogSize;
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
          padding: 60,
          fontFamily: 'Noto Sans',
        }}
      >
        {/* Header: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
              <rect width="24" height="24" rx="4" fill={colors.text} />
              <path d="M7 8h10M7 12h6M7 16h8" stroke={colors.background} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 28, fontWeight: 700, color: colors.text }}>GRIP</span>
          </div>
          <div style={{ fontSize: 20, color: colors.textSubtle }}>usegrip.xyz</div>
        </div>

        {/* Repo section */}
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48, marginTop: 40 }}>
          <img
            src={githubRepo.owner.avatar_url}
            alt={`${owner} avatar`}
            width={140}
            height={140}
            style={{ borderRadius: 16, border: `4px solid ${colors.border}` }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 24, color: colors.textMuted }}>{owner}</span>
              <span style={{ fontSize: 52, fontWeight: 700, color: colors.text }}>{truncate(repo, 30)}</span>
            </div>

            {githubRepo.description && (
              <div style={{ fontSize: 24, color: colors.textSubtle, marginTop: 8 }}>
                {truncate(githubRepo.description, 100)}
              </div>
            )}

            {bounties.length > 0 && (
              <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: `${colors.lime}20`,
                    border: `1px solid ${colors.lime}40`,
                    borderRadius: 12,
                    padding: '12px 24px',
                  }}
                >
                  <span style={{ fontSize: 28, fontWeight: 700, color: colors.lime }}>{openBounties.length}</span>
                  <span style={{ fontSize: 20, color: colors.lime }}>
                    {openBounties.length === 1 ? 'open bounty' : 'open bounties'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: `${colors.blue}20`,
                    border: `1px solid ${colors.blue}40`,
                    borderRadius: 12,
                    padding: '12px 24px',
                  }}
                >
                  <span style={{ fontSize: 28, fontWeight: 700, color: colors.blue }}>{formatAmount(totalFunded)}</span>
                  <span style={{ fontSize: 20, color: colors.blue }}>total funded</span>
                </div>
              </div>
            )}

            {bounties.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, color: colors.textSubtle, fontSize: 20 }}>
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
            paddingTop: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: colors.textSubtle, fontSize: 18 }}>
            {githubRepo.stargazers_count > 0 && <span>⭐ {githubRepo.stargazers_count.toLocaleString()}</span>}
            {githubRepo.language && <span>· {githubRepo.language}</span>}
          </div>
          <span style={{ fontSize: 18, color: colors.textSubtle }}>Git Reward & Incentive Platform</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
