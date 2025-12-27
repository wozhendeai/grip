import { Button } from '@/components/ui/button';
import { getRepoSettingsByName, isUserRepoOwner } from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import Link from 'next/link';
import { ClaimRepoCard } from '../_components/claim-repo-card';
import { ClaimResultBanner } from './_components/claim-result-banner';
import { SettingsLayout } from './_components/settings-layout';

interface SettingsPageProps {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{ claimed?: string; error?: string }>;
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
export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const { owner, repo } = await params;
  const { claimed, error } = await searchParams;

  // Get session first (don't redirect yet - we may show claim UI)
  const session = await getSession();

  // Get repo settings
  const repoSettings = await getRepoSettingsByName(owner, repo);

  // If repo not claimed, show claim flow
  if (!repoSettings) {
    // Not logged in - prompt to sign in first
    if (!session?.user) {
      return (
        <div className="container py-8 text-center">
          <h1 className="text-2xl font-bold">Claim this repository</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to claim {owner}/{repo} and unlock maintainer features.
          </p>
          <Button
            nativeButton={false}
            render={<Link href={`/login?callbackUrl=/${owner}/${repo}/settings`} />}
            className="mt-4"
          >
            Sign in to claim
          </Button>
        </div>
      );
    }

    // Logged in - show claim card
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <ClaimRepoCard owner={owner} repo={repo} />
      </div>
    );
  }

  // Repo is claimed - require auth from here on
  if (!session?.user) {
    return (
      <div className="container py-8 text-center">
        <h1 className="text-2xl font-bold">Sign in required</h1>
        <p className="mt-2 text-muted-foreground">
          Sign in to access settings for {owner}/{repo}
        </p>
        <Button
          nativeButton={false}
          render={<Link href={`/login?callbackUrl=/${owner}/${repo}/settings`} />}
          className="mt-4"
        >
          Sign in
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
        <Button
          nativeButton={false}
          render={<Link href={`/${owner}/${repo}`}>Back to Repo</Link>}
          className="mt-4"
        />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <ClaimResultBanner claimed={claimed === 'true'} error={error} />
      <SettingsLayout githubRepoId={Number(repoSettings.githubRepoId)} owner={owner} repo={repo} />
    </div>
  );
}
