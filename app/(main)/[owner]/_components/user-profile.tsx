import type {
  getBountyDataByGitHubId,
  getUserByName,
  getUserOrganizations,
} from '@/db/queries/users';
import type { getSubmissionsByUser } from '@/db/queries/submissions';
import type { GitHubActivity, GitHubUser, GitHubRepoMinimal } from '@/lib/github';
import { ProfileHeader } from './profile-header';
import { ActivityList, type ActivityItem } from './activity-list';

interface UserProfileProps {
  github: GitHubUser;
  githubActivity: GitHubActivity;
  bountyLaneUser: Awaited<ReturnType<typeof getUserByName>>;
  bountyData: Awaited<ReturnType<typeof getBountyDataByGitHubId>>;
  organizations: Awaited<ReturnType<typeof getUserOrganizations>>;
  userSubmissions?: Awaited<ReturnType<typeof getSubmissionsByUser>>;
  repos?: GitHubRepoMinimal[];
  isOwnProfile?: boolean;
  isLoggedIn?: boolean;
}

export function UserProfile({
  github,
  bountyLaneUser,
  bountyData,
  organizations,
  userSubmissions = [],
  repos = [],
}: UserProfileProps) {
  // 1. Transform Funded Bounties
  const fundedItems: ActivityItem[] = bountyData.funded.map((b) => ({
    id: b.id,
    type: 'funded',
    title: b.title,
    repoOwner: b.repoOwner,
    repoName: b.repoName,
    amount: b.amount,
    date: b.createdAt,
    url: b.repoOwner && b.repoName ? `/${b.repoOwner}/${b.repoName}/bounties/${b.id}` : '#',
  }));

  // 2. Transform Submissions (Completed & In Progress)
  const submissionItems: ActivityItem[] = userSubmissions
    .map((s): ActivityItem | null => {
      // Determine type
      // Paid = completed
      // Pending/Approved/Merged = in_progress
      // Rejected/Expired = ignore (or handle separately?)
      let type: ActivityItem['type'] | null = null;
      if (s.submission.status === 'paid') type = 'completed';
      else if (['pending', 'approved', 'merged'].includes(s.submission.status))
        type = 'in_progress';

      if (!type) return null;

      // For completed, use total funded amount as "earned".
      // For in progress, show the bounty amount.
      return {
        id: s.bounty.id,
        type,
        title: s.bounty.title,
        repoOwner: s.bounty.githubOwner,
        repoName: s.bounty.githubRepo,
        amount: s.bounty.totalFunded,
        date: s.submission.createdAt, // Or paidAt for completed? using createdAt for consistency or s.bounty.paidAt
        url:
          s.bounty.githubOwner && s.bounty.githubRepo
            ? `/${s.bounty.githubOwner}/${s.bounty.githubRepo}/bounties/${s.bounty.id}`
            : '#',
      };
    })
    .filter((item): item is ActivityItem => item !== null);

  // Combine all items
  const allActivity = [...fundedItems, ...submissionItems];

  // 4. Calculate Header Stats
  const totalEarned = BigInt(bountyData.totalEarned); // From payouts table
  const bountiesCompleted = bountyLaneUser?.bountiesCompleted || 0;
  const bountiesFunded = bountyData.funded.length; // Or use bountyData.totalFunded for amount

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6">
        <ProfileHeader
          user={{
            avatarUrl: github.avatar_url,
            name: github.name,
            username: github.login,
            bio: github.bio,
            joinedAt: bountyLaneUser?.createdAt,
            htmlUrl: github.html_url,
          }}
          stats={{
            totalEarned,
            bountiesCompleted,
            bountiesFunded,
          }}
          organizations={organizations}
        />

        <ActivityList items={allActivity} />
      </div>
    </div>
  );
}
