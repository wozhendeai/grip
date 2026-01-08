import { getGitHubToken } from '@/lib/github';
import { getUserOrgMembership, getUserOrganizations } from '@/lib/github';
import { requireAuth } from '@/lib/auth/auth-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/github/organizations
 *
 * Fetch user's GitHub organizations where they have admin role
 *
 * Response:
 * - organizations: GitHubOrganization[] (only admin orgs)
 *
 * Requires:
 * - User must be authenticated
 * - User must have GitHub account connected
 *
 * Security: Only returns organizations where user is admin
 * This prevents users from linking organizations they don't control
 *
 * Example usage:
 *   const res = await fetch('/api/github/organizations');
 *   const { organizations } = await res.json();
 *   // [{ id: 123, login: "my-org", avatar_url: "...", ... }]
 */
export async function GET() {
  // 1. Verify authentication
  const session = await requireAuth();

  // 2. Get user's GitHub OAuth token
  const token = await getGitHubToken(session.user.id);
  if (!token) {
    return NextResponse.json(
      {
        error:
          'GitHub account not connected. Please connect your GitHub account to link organizations.',
      },
      { status: 400 }
    );
  }

  try {
    // 3. Fetch all user's GitHub organizations
    const allOrgs = await getUserOrganizations(token);

    // 4. Filter to admin-only organizations
    // We need to check each org individually for the user's role
    const adminOrgs = await Promise.all(
      allOrgs.map(async (org) => {
        const membership = await getUserOrgMembership(token, org.login);
        return membership?.role === 'admin' ? org : null;
      })
    );

    // Remove nulls (non-admin orgs)
    const filteredOrgs = adminOrgs.filter((org) => org !== null);

    return NextResponse.json({
      organizations: filteredOrgs,
    });
  } catch (error) {
    // Detect 403 scope errors (user needs to grant permission)
    if (error instanceof Error && error.message.includes('403')) {
      console.info('User needs to grant read:org scope - returning re-auth prompt');
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_SCOPE',
          message: 'Additional permissions required to access organizations',
          requiredScope: 'read:org',
        },
        { status: 403 }
      );
    }

    console.error('Failed to fetch GitHub organizations:', error);

    // Generic error response
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error occurred while fetching organizations';

    return NextResponse.json(
      {
        error: 'Failed to fetch GitHub organizations',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
