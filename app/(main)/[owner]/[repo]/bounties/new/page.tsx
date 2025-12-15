import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth-server';
import { getRepoSettingsByName } from '@/lib/db/queries/repo-settings';
import { fetchGitHubRepo } from '@/lib/github/repo';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CreateBountyForm } from './_components/create-bounty-form';

interface NewBountyPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Create Bounty Page - PERMISSIONLESS
 *
 * Works for ANY public GitHub repository.
 * - Claimed repos: Check project membership
 * - Unclaimed repos: Anyone logged in can create bounties
 */
export default async function NewBountyPage({ params }: NewBountyPageProps) {
  const { owner, repo } = await params;

  // Check authentication
  const session = await getSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/${repo}/bounties/new`);
  }

  // 1. Fetch GitHub repo (works for ANY public repo)
  const githubRepo = await fetchGitHubRepo(owner, repo);

  if (!githubRepo) {
    // Only 404 if GitHub repo doesn't exist
    return notFound();
  }

  if (githubRepo.private) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Private Repository</h1>
        <p className="mt-2 text-muted-foreground">
          Cannot create bounties on private repositories.
        </p>
        <Button render={<Link href="/explore" />} className="mt-4">
          Browse Bounties
        </Button>
      </div>
    );
  }

  // 2. Check if repo settings exist (optional - bounties work without settings)
  const repoSettings = await getRepoSettingsByName(owner, repo);

  // 3. Permission check - PERMISSIONLESS model: anyone logged in can create bounties
  const canCreate = !!session; // Already checked above, but explicit

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href={`/${owner}/${repo}`} className="hover:text-foreground">
          {owner}/{repo}
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/${owner}/${repo}/bounties`} className="hover:text-foreground">
          Bounties
        </Link>
        <span className="mx-2">/</span>
        <span>New</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Create Bounty</h1>
        <p className="mt-2 text-muted-foreground">
          Select an open issue and set a bounty amount. Contributors can then submit their work and
          get paid when you approve it.
        </p>
      </div>

      {/* Form */}
      <CreateBountyForm
        githubRepo={githubRepo}
        projectId={repoSettings?.githubRepoId.toString() ?? null}
        owner={owner}
        repo={repo}
      />
    </div>
  );
}
