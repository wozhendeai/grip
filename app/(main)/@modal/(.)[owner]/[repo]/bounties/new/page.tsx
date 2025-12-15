import { RouteModal } from '@/components/modal/route-modal';
import { getSession } from '@/lib/auth-server';
import { getRepoSettingsByName } from '@/lib/db/queries/repo-settings';
import { fetchGitHubRepo } from '@/lib/github/repo';
import { notFound, redirect } from 'next/navigation';
import { CreateBountyForm } from '../../../../../[owner]/[repo]/bounties/new/_components/create-bounty-form';

interface NewBountyModalProps {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Create bounty modal (intercepted route) - PERMISSIONLESS
 *
 * Shows bounty creation form in a modal when navigating within the app.
 * Direct URL access shows the full page instead.
 */
export default async function NewBountyModal({ params }: NewBountyModalProps) {
  const { owner, repo } = await params;

  // Check authentication
  const session = await getSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/${repo}/bounties/new`);
  }

  // Fetch GitHub repo (works for ANY public repo)
  const githubRepo = await fetchGitHubRepo(owner, repo);
  if (!githubRepo) {
    return notFound();
  }

  if (githubRepo.private) {
    return (
      <RouteModal title="Private Repository">
        <div className="p-6 text-center">
          <h2 className="text-lg font-medium">Private Repository</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cannot create bounties on private repositories.
          </p>
        </div>
      </RouteModal>
    );
  }

  // Check if repo settings exist (optional - bounties work without settings)
  const repoSettings = await getRepoSettingsByName(owner, repo);

  return (
    <RouteModal title="Create Bounty">
      <div className="p-6">
        <p className="mb-6 text-sm text-muted-foreground">
          Select an open issue and set a bounty amount. Contributors can then claim the bounty and
          get paid when their PR is merged.
        </p>
        <CreateBountyForm
          githubRepo={githubRepo}
          projectId={repoSettings?.githubRepoId.toString() ?? null}
          owner={owner}
          repo={repo}
        />
      </div>
    </RouteModal>
  );
}
