import { getBountyDataByGitHubId, getUserByName } from '@/db/queries/users';
import { getOrgBySlug, getOrgBountyData } from '@/db/queries/organizations';
import { fetchGitHubUser } from '@/lib/github/api';
import { getOrganization } from '@/lib/github';
import { colors, formatAmount, getFontOptions, twitterSize, truncate } from '@/lib/og/shared';
import { ImageResponse } from 'next/og';

export const alt = 'Profile on GRIP';
export const size = twitterSize;
export const contentType = 'image/png';

const RESERVED_ROUTES = new Set([
  'explore', 'wallet', 'settings', 'notifications', 'login', 'claim', 'tx', 'api', 'bounties',
]);

export default async function Image({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;
  const fonts = await getFontOptions();

  if (RESERVED_ROUTES.has(owner)) {
    return notFoundImage(fonts);
  }

  // 1. Try GRIP org first
  const gripOrg = await getOrgBySlug(owner);
  if (gripOrg && gripOrg.visibility === 'public') {
    const bountyData = await getOrgBountyData(gripOrg.id);
    return orgImage(fonts, {
      name: gripOrg.name,
      avatar: gripOrg.logo ?? null,
      description: 'Organization on GRIP',
      stats: {
        bountiesFunded: bountyData?.fundedCount ?? 0,
        totalFunded: bountyData?.totalFunded ?? BigInt(0),
      },
    });
  }

  // 2. Try GitHub user
  const githubUser = await fetchGitHubUser(owner);
  if (githubUser) {
    const bountyData = await getBountyDataByGitHubId(BigInt(githubUser.id));
    const bountyLaneUser = await getUserByName(owner);

    return userImage(fonts, {
      name: githubUser.name || githubUser.login,
      username: githubUser.login,
      avatar: githubUser.avatar_url,
      bio: githubUser.bio,
      stats: {
        bountiesCompleted: bountyData.completed.length,
        totalEarned: bountyData.totalEarned,
        bountiesFunded: bountyData.funded.length,
        totalFunded: bountyData.totalFunded,
      },
      hasGripAccount: !!bountyLaneUser,
    });
  }

  // 3. Try GitHub org
  const githubOrg = await getOrganization(owner);
  if (githubOrg) {
    return orgImage(fonts, {
      name: githubOrg.name ?? githubOrg.login,
      avatar: githubOrg.avatar_url,
      description: githubOrg.description,
      stats: { bountiesFunded: 0, totalFunded: BigInt(0) },
    });
  }

  return notFoundImage(fonts);
}

type FontOptions = Awaited<ReturnType<typeof getFontOptions>>;

function notFoundImage(fonts: FontOptions) {
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
        <div style={{ fontSize: 44, fontWeight: 700 }}>Profile Not Found</div>
      </div>
    ),
    { ...size, fonts }
  );
}

function userImage(
  fonts: FontOptions,
  { name, username, avatar, bio, stats, hasGripAccount }: {
    name: string;
    username: string;
    avatar: string;
    bio: string | null;
    stats: { bountiesCompleted: number; totalEarned: number; bountiesFunded: number; totalFunded: number };
    hasGripAccount: boolean;
  }
) {
  const hasActivity = stats.bountiesCompleted > 0 || stats.bountiesFunded > 0;

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
              <rect width="24" height="24" rx="4" fill={colors.text} />
              <path d="M7 8h10M7 12h6M7 16h8" stroke={colors.background} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>GRIP</span>
          </div>
          <div style={{ fontSize: 18, color: colors.textSubtle }}>usegrip.xyz</div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 40, marginTop: 32 }}>
          <img
            src={avatar}
            alt={`${username} avatar`}
            width={140}
            height={140}
            style={{ borderRadius: '50%', border: `3px solid ${colors.border}` }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: colors.text }}>{truncate(name, 25)}</span>
              {hasGripAccount && (
                <div
                  style={{
                    backgroundColor: `${colors.lime}20`,
                    border: `1px solid ${colors.lime}40`,
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 14,
                    color: colors.lime,
                  }}
                >
                  GRIP Member
                </div>
              )}
            </div>

            <div style={{ fontSize: 24, color: colors.textMuted }}>@{username}</div>

            {bio && (
              <div style={{ fontSize: 18, color: colors.textSubtle, marginTop: 4 }}>{truncate(bio, 80)}</div>
            )}

            {hasActivity && (
              <div style={{ display: 'flex', gap: 28, marginTop: 12 }}>
                {stats.bountiesCompleted > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: colors.green }}>{stats.bountiesCompleted}</span>
                    <span style={{ fontSize: 14, color: colors.textSubtle }}>
                      {stats.bountiesCompleted === 1 ? 'bounty completed' : 'bounties completed'}
                    </span>
                  </div>
                )}
                {stats.totalEarned > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: colors.green }}>{formatAmount(stats.totalEarned)}</span>
                    <span style={{ fontSize: 14, color: colors.textSubtle }}>earned</span>
                  </div>
                )}
                {stats.bountiesFunded > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: colors.blue }}>{stats.bountiesFunded}</span>
                    <span style={{ fontSize: 14, color: colors.textSubtle }}>
                      {stats.bountiesFunded === 1 ? 'bounty funded' : 'bounties funded'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', borderTop: `1px solid ${colors.border}`, paddingTop: 20 }}>
          <span style={{ fontSize: 16, color: colors.textSubtle }}>Git Reward & Incentive Platform</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}

function orgImage(
  fonts: FontOptions,
  { name, avatar, description, stats }: {
    name: string;
    avatar: string | null;
    description: string | null;
    stats: { bountiesFunded: number; totalFunded: bigint };
  }
) {
  const hasActivity = stats.bountiesFunded > 0;

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
              <rect width="24" height="24" rx="4" fill={colors.text} />
              <path d="M7 8h10M7 12h6M7 16h8" stroke={colors.background} strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>GRIP</span>
          </div>
          <div style={{ fontSize: 18, color: colors.textSubtle }}>usegrip.xyz</div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 40, marginTop: 32 }}>
          {avatar ? (
            <img
              src={avatar}
              alt={`${name} logo`}
              width={140}
              height={140}
              style={{ borderRadius: 14, border: `3px solid ${colors.border}` }}
            />
          ) : (
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: 14,
                backgroundColor: '#27272a',
                border: `3px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 56, color: colors.textSubtle }}>{name.charAt(0).toUpperCase()}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 40, fontWeight: 700, color: colors.text }}>{truncate(name, 25)}</span>
              <div
                style={{
                  backgroundColor: `${colors.blue}20`,
                  border: `1px solid ${colors.blue}40`,
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 14,
                  color: colors.blue,
                }}
              >
                Organization
              </div>
            </div>

            {description && (
              <div style={{ fontSize: 20, color: colors.textMuted, marginTop: 4 }}>{truncate(description, 100)}</div>
            )}

            {hasActivity && (
              <div style={{ display: 'flex', gap: 28, marginTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: colors.blue }}>{stats.bountiesFunded}</span>
                  <span style={{ fontSize: 14, color: colors.textSubtle }}>
                    {stats.bountiesFunded === 1 ? 'bounty funded' : 'bounties funded'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 28, fontWeight: 700, color: colors.blue }}>{formatAmount(stats.totalFunded)}</span>
                  <span style={{ fontSize: 14, color: colors.textSubtle }}>total funded</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', borderTop: `1px solid ${colors.border}`, paddingTop: 20 }}>
          <span style={{ fontSize: 16, color: colors.textSubtle }}>Git Reward & Incentive Platform</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
