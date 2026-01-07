import {
  createRepoSettings,
  getRepoSettingsByGithubRepoId,
  getRepoSettingsByUser,
} from '@/db/queries/repo-settings';
import { requireAuth } from '@/lib/auth/auth-server';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { createRepoSettingsSchema } from '@/app/api/_lib/schemas';
import type { NextRequest } from 'next/server';

/**
 * GET /api/repo-settings
 *
 * List all repositories the authenticated user has claimed/configured.
 * Returns repo settings with GitHub metadata.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const repoSettings = await getRepoSettingsByUser(session.user.id);

    return Response.json({ repoSettings });
  } catch (error) {
    return handleRouteError(error, 'fetching repo settings');
  }
}

/**
 * POST /api/repo-settings
 *
 * Claim/configure a repository for bounty management.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await validateBody(request, createRepoSettingsSchema);

    const repoId = BigInt(body.githubRepoId);

    // Check if repo settings already exist
    const existing = await getRepoSettingsByGithubRepoId(repoId);
    if (existing) {
      return Response.json(
        { error: 'Repo settings already exist', repoSettings: existing },
        { status: 409 }
      );
    }

    const repoSettings = await createRepoSettings({
      verifiedOwnerUserId: session.user.id,
      githubRepoId: repoId,
      githubOwner: body.githubOwner,
      githubRepo: body.githubRepo,
    });

    return Response.json({ repoSettings }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, 'creating repo settings');
  }
}
