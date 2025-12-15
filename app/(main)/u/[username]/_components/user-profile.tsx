import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription } from '@/components/ui/empty';
import { UserAvatar } from '@/components/user/user-avatar';
import { getUserEarningsOverTime } from '@/lib/db/queries/payouts';
import { getSubmissionsByUser } from '@/lib/db/queries/submissions';
import type { getBountyDataByGitHubId, getUserByName } from '@/lib/db/queries/users';
import type { GitHubActivity, GitHubUser } from '@/lib/github/user';
import { formatTokenAmount } from '@/lib/tempo/format';
import { formatTimeAgo } from '@/lib/utils';
import { ExternalLink, Github } from 'lucide-react';
import Link from 'next/link';
import { ActivityBadge } from './activity-badge';
import { ContributionsChart } from './contributions-chart';
import { FundedBountiesSection } from './funded-bounties-section';
import { ProjectsSection } from './projects-section';
import { SendPaymentAction } from './send-payment-action';

interface UserProfileProps {
  github: GitHubUser;
  githubActivity: GitHubActivity;
  bountyLaneUser: Awaited<ReturnType<typeof getUserByName>>;
  bountyData: Awaited<ReturnType<typeof getBountyDataByGitHubId>>;
  isOwnProfile?: boolean;
  isLoggedIn?: boolean;
}

export async function UserProfile({
  github,
  githubActivity,
  bountyLaneUser,
  bountyData,
  isOwnProfile = false,
  isLoggedIn = false,
}: UserProfileProps) {
  const userId = bountyLaneUser?.id ?? null;

  // Fetch detailed submission data (returns empty arrays for non-signed-up users)
  const userSubmissions = userId ? await getSubmissionsByUser(userId) : [];
  const defaultEarnings = await getUserEarningsOverTime(userId, '1y');

  // Filter submissions by status (completed = paid submissions)
  const completedSubmissions = userSubmissions.filter((s) => s.submission.status === 'paid');

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <section className="border-b border-border bg-card/30">
        <div className="container py-12">
          {/* User Info */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <img
                src={github.avatar_url}
                alt={github.login}
                className="h-20 w-20 rounded-full border-2 border-border"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold md:text-3xl">{github.name || github.login}</h1>
                  <ActivityBadge activity={githubActivity} />
                </div>
                <a
                  href={github.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-4 w-4" />
                  <span>@{github.login}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>

                {githubActivity.lastActiveAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last active {formatTimeAgo(new Date(githubActivity.lastActiveAt))}
                  </p>
                )}

                {github.bio && (
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">{github.bio}</p>
                )}
              </div>
            </div>

            {/* Send Payment Button */}
            {isLoggedIn && !isOwnProfile && (
              <SendPaymentAction recipientUsername={github.login} recipientName={github.name} />
            )}
          </div>

          {/* BountyLane Stats */}
          <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="text-success font-medium">
                ${formatTokenAmount(bountyData.totalEarned.toString(), { trim: true })}
              </span>
              <span>earned</span>
            </span>
            <span>{bountyLaneUser?.bountiesCompleted ?? 0} completed</span>
            <span>{bountyData.funded.length} funded</span>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <ProjectsSection username={github.login} userId={userId} isOwnProfile={isOwnProfile} />

      {/* Activity Section */}
      <section className="container py-8">
        {/* Contributions Chart */}
        <div className="mb-8">
          <ContributionsChart
            username={github.login}
            initialData={defaultEarnings}
            initialPeriod="1y"
          />
        </div>

        {/* Funded Bounties */}
        {bountyData.funded.length > 0 && (
          <div className="mb-8">
            <FundedBountiesSection bounties={bountyData.funded} />
          </div>
        )}

        {/* Completed Bounties */}
        <div>
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">Completed Bounties</h2>

          {completedSubmissions.length > 0 ? (
            <div className="space-y-4">
              {completedSubmissions.slice(0, 5).map((item, index) => (
                <Link
                  key={item.bounty.id}
                  href={`/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`}
                  className="block opacity-0 animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center rounded bg-success/10 border border-success/30 px-1.5 py-0.5 text-[10px] font-bold uppercase text-success">
                            PAID
                          </span>
                          <code className="text-xs text-muted-foreground">
                            {item.bounty.githubOwner}/{item.bounty.githubRepo}
                          </code>
                        </div>
                        <h3 className="font-medium group-hover:text-muted-foreground transition-colors truncate">
                          {item.bounty.title}
                        </h3>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-lg font-bold">
                          +${formatTokenAmount(item.bounty.totalFunded.toString(), { trim: true })}
                        </span>
                        <p className="text-xs text-muted-foreground">USDC</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty className="border-border bg-card/50">
              <EmptyDescription>No bounties completed</EmptyDescription>
            </Empty>
          )}
        </div>
      </section>
    </div>
  );
}
