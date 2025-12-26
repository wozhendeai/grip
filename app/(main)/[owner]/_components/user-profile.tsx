import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user/user-avatar';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { getUserEarningsOverTime } from '@/db/queries/payouts';
import { getSubmissionsByUser } from '@/db/queries/submissions';
import type {
  getBountyDataByGitHubId,
  getUserByName,
  getUserOrganizations,
} from '@/db/queries/users';
import type { GitHubActivity, GitHubUser, GitHubRepo } from '@/lib/github';
import { formatTimeAgo } from '@/lib/utils';
import { ExternalLink, FolderGit2, Github } from 'lucide-react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { ActivityBadge } from './activity-badge';
import { ContributionsChart } from './contributions-chart';
import { EntityHeader } from './entity-header';
import { FundedBountiesSection } from './funded-bounties-section';
import { MemberOfSection } from './member-of-section';
import { ProjectsSection } from './projects-section';
import { SendPaymentAction } from './send-payment-action';

interface UserProfileProps {
  github: GitHubUser;
  githubActivity: GitHubActivity;
  bountyLaneUser: Awaited<ReturnType<typeof getUserByName>>;
  bountyData: Awaited<ReturnType<typeof getBountyDataByGitHubId>>;
  organizations: Awaited<ReturnType<typeof getUserOrganizations>>;
  repos?: GitHubRepo[];
  isOwnProfile?: boolean;
  isLoggedIn?: boolean;
}

export async function UserProfile({
  github,
  githubActivity,
  bountyLaneUser,
  bountyData,
  organizations,
  repos = [],
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
      <EntityHeader
        type="user"
        name={github.name || github.login}
        handle={github.login}
        avatar={github.avatar_url}
        description={github.bio}
        isLinked={!!bountyLaneUser}
        metadata={{
          primary: (
            <>
              {github.location && <span>{github.location}</span>}
              {github.blog && (
                <>
                  {github.location && <span className="mx-2 text-xs">·</span>}
                  <a
                    href={github.blog.startsWith('http') ? github.blog : `https://${github.blog}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>{github.blog}</span>
                  </a>
                </>
              )}
            </>
          ),
          secondary: (
            <>
              <a
                href={github.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>github.com/{github.login}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              {github.created_at && (
                <>
                  <span className="mx-2 text-xs">·</span>
                  <span>
                    Joined{' '}
                    {new Date(github.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </span>
                </>
              )}
            </>
          ),
        }}
        stats={
          bountyLaneUser ? (
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="text-success font-medium">
                  ${formatUnits(BigInt(bountyData.totalEarned), 6)}
                </span>
                <span>earned</span>
              </span>
              <span>{bountyLaneUser.bountiesCompleted} completed</span>
              <span>{bountyData.funded.length} funded</span>
            </div>
          ) : undefined
        }
        action={
          isLoggedIn && !isOwnProfile ? (
            <SendPaymentAction recipientUsername={github.login} recipientName={github.name} />
          ) : undefined
        }
      >
        {/* ActivityBadge + last active */}
        <div className="mt-3">
          <ActivityBadge activity={githubActivity} />
          {githubActivity.lastActiveAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last active {formatTimeAgo(new Date(githubActivity.lastActiveAt))}
            </p>
          )}
        </div>
      </EntityHeader>

      {/* Conditional content based on BountyLane membership */}
      {bountyLaneUser ? (
        <>
          {/* Member Of Section */}
          {organizations.length > 0 && <MemberOfSection organizations={organizations} />}

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
            {completedSubmissions.length > 0 && (
              <div>
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                  Completed Bounties
                </h2>

                <div className="space-y-4">
                  {completedSubmissions.slice(0, 5).map((item, index) => (
                    <Link
                      key={item.bounty.id}
                      href={`/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`}
                      className="block"
                    >
                      <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center rounded bg-success/10 border border-success/30 px-1.5 py-0.5 text-xs font-bold uppercase text-success">
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
                              +${formatUnits(BigInt(item.bounty.totalFunded), 6)}
                            </span>
                            <p className="text-xs text-muted-foreground">USDC</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* GitHub repos section for unlinked users */}
          <section className="container py-8">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">REPOSITORIES</h2>

            {repos && repos.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {repos.slice(0, 30).map((repo) => (
                  <Link
                    key={repo.id}
                    href={`/${repo.owner.login}/${repo.name}`}
                    className="block rounded-lg border border-border bg-card p-4 hover:border-muted-foreground/50 transition-colors"
                  >
                    <h3 className="font-medium mb-1">{repo.name}</h3>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {repo.language && <span>{repo.language}</span>}
                      <span>★ {repo.stargazers_count}</span>
                      <span>⑂ {repo.forks_count}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty className="border-border bg-card/50">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderGit2 />
                  </EmptyMedia>
                  <EmptyTitle>No public repositories</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </section>
        </>
      )}
    </div>
  );
}
