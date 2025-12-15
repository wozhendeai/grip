import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/auth-server';
import { getRepoSettingsByName, isUserRepoOwner } from '@/lib/db/queries/repo-settings';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SettingsLayout } from './_components/settings-layout';

interface SettingsPageProps {
  params: Promise<{ owner: string; repo: string }>;
}

/**
 * Repo settings page (protected)
 *
 * Only accessible by repo owner.
 * Provides tabs for:
 * - General: Repo info
 * - Treasury: Wallet setup and balance (owner's wallet)
 * - Webhooks: GitHub webhook configuration
 */
export default async function SettingsPage({ params }: SettingsPageProps) {
  const { owner, repo } = await params;

  // Check authentication
  const session = await getSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/${repo}/settings`);
  }

  // Get repo settings
  const repoSettings = await getRepoSettingsByName(owner, repo);
  if (!repoSettings) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Repo Settings not found</h1>
        <p className="mt-2 text-muted-foreground">
          No settings found for {owner}/{repo}
        </p>
        <Button render={<Link href="/explore" />} className="mt-4">
          Browse Bounties
        </Button>
      </div>
    );
  }

  // Check permissions - must be repo owner
  const isOwner = await isUserRepoOwner(repoSettings.githubRepoId, session.user.id);
  if (!isOwner) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">
          You don&apos;t have permission to manage this repo.
        </p>
        <Button render={<Link href={`/${owner}/${repo}`}>Back to Repo</Link>} className="mt-4" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <SettingsLayout githubRepoId={Number(repoSettings.githubRepoId)} owner={owner} repo={repo} />
    </div>
  );
}
