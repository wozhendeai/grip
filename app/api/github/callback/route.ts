import {
  createRepoSettings,
  getRepoSettingsByName,
  updateRepoInstallation,
} from '@/db/queries/repo-settings';
import { getSession } from '@/lib/auth/auth-server';
import { fetchGitHubRepo, getInstallationRepos, verifyClaimState } from '@/lib/github';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

/**
 * Extract callbackUrl from state without signature verification.
 * Used only for dev proxy detection - the dev server will verify the full signature.
 */
function extractCallbackUrl(signedState: string): string | undefined {
  try {
    const parts = signedState.split('.');
    if (parts.length !== 2) return undefined;
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return data.callbackUrl;
  } catch {
    return undefined;
  }
}

/**
 * GET /api/github/callback
 *
 * Handle the callback from GitHub after App installation.
 * Verifies the state parameter and creates/updates repo_settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const installationId = searchParams.get('installation_id');
  const state = searchParams.get('state');
  const setupAction = searchParams.get('setup_action');

  // Handle case where user cancelled or there's no installation
  if (!installationId) {
    console.log('[github-callback] No installation_id, user likely cancelled');
    return redirect('/?error=installation_cancelled');
  }

  // Verify state parameter
  if (!state) {
    console.log('[github-callback] Missing state parameter');
    return redirect('/?error=missing_state');
  }

  // Dev proxy: redirect to localhost if callback originated from dev environment
  // This MUST happen before state verification because dev uses a different secret.
  // Security: Only proxy to localhost/127.0.0.1, only when running on production
  const currentHostname = new URL(request.url).hostname;
  const isProduction = currentHostname === 'usegrip.xyz' || currentHostname === 'www.usegrip.xyz';

  if (isProduction) {
    const callbackUrl = extractCallbackUrl(state);
    if (callbackUrl) {
      const DEV_HOSTS = ['localhost', '127.0.0.1'];
      let isDevTarget = false;
      try {
        const targetHostname = new URL(callbackUrl).hostname;
        isDevTarget = DEV_HOSTS.includes(targetHostname);
      } catch {
        isDevTarget = false;
      }

      if (isDevTarget) {
        // Proxy to dev callback URL with same params - dev server will verify signature
        const proxyUrl = new URL(callbackUrl);
        proxyUrl.searchParams.set('installation_id', installationId);
        proxyUrl.searchParams.set('state', state);
        if (setupAction) {
          proxyUrl.searchParams.set('setup_action', setupAction);
        }

        console.log(`[github-callback] Proxying to dev: ${proxyUrl.origin}`);
        return redirect(proxyUrl.toString());
      }

      // Log warning if non-dev callbackUrl (potential attack attempt)
      console.warn(`[github-callback] Ignoring non-dev callbackUrl: ${callbackUrl}`);
    }
  }

  const claimState = verifyClaimState(state);
  if (!claimState) {
    console.log('[github-callback] Invalid or expired state');
    return redirect('/?error=invalid_state');
  }

  // Verify user session matches state
  const session = await getSession();
  if (!session?.user || session.user.id !== claimState.userId) {
    console.log('[github-callback] Session mismatch or expired');
    return redirect(
      `/login?error=session_expired&next=${encodeURIComponent(`/${claimState.owner}/${claimState.repo}`)}`
    );
  }

  // Verify the target repo is in the installation
  let repos: Awaited<ReturnType<typeof getInstallationRepos>>;
  try {
    repos = await getInstallationRepos(installationId);
  } catch (error) {
    console.error('[github-callback] Failed to fetch installation repos:', error);
    return redirect(`/${claimState.owner}/${claimState.repo}?error=github_api_error`);
  }

  const targetFullName = `${claimState.owner}/${claimState.repo}`;
  const targetRepo = repos.find((r) => r.full_name.toLowerCase() === targetFullName.toLowerCase());

  if (!targetRepo) {
    console.log(`[github-callback] Repo ${targetFullName} not in installation`);
    return redirect(`/${claimState.owner}/${claimState.repo}?error=repo_not_in_installation`);
  }

  // Get GitHub repo details for the ID
  const githubRepo = await fetchGitHubRepo(claimState.owner, claimState.repo);
  if (!githubRepo) {
    console.log(`[github-callback] Repo ${targetFullName} not found on GitHub`);
    return redirect(`/${claimState.owner}/${claimState.repo}?error=repo_not_found`);
  }

  // Create or update repo_settings
  try {
    const existing = await getRepoSettingsByName(claimState.owner, claimState.repo);

    if (existing) {
      // Update existing record
      await updateRepoInstallation(existing.githubRepoId, installationId, session.user.id);
      console.log(`[github-callback] Updated repo_settings for ${targetFullName}`);
    } else {
      // Create new record
      await createRepoSettings({
        verifiedOwnerUserId: session.user.id,
        githubRepoId: BigInt(githubRepo.id),
        githubOwner: claimState.owner,
        githubRepo: claimState.repo,
        installationId: BigInt(installationId),
      });
      console.log(`[github-callback] Created repo_settings for ${targetFullName}`);
    }
  } catch (error) {
    console.error('[github-callback] Failed to create/update repo_settings:', error);
    return redirect(`/${claimState.owner}/${claimState.repo}?error=database_error`);
  }

  // Success - redirect to settings page
  return redirect(`/${claimState.owner}/${claimState.repo}/settings?claimed=true`);
}
