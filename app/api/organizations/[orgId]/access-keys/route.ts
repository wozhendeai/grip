import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-server';
import { createOrgAccessKey } from '@/lib/tempo/access-keys';
import { getOrgAccessKeys, isOrgOwner, isOrgMember } from '@/db/queries/organizations';
import { tempoTestnet } from 'viem/chains';

type RouteContext = {
  params: Promise<{ orgId: string }>;
};

/**
 * POST /api/organizations/[orgId]/access-keys
 *
 * Create Access Key for organization team member (owner only)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { orgId } = await context.params;

    // Only owner can authorize Access Keys
    if (!(await isOrgOwner(orgId, session.user.id))) {
      return NextResponse.json(
        { error: 'Only organization owner can authorize Access Keys' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      teamMemberUserId,
      spendingLimits,
      expiryDays,
      authorizationSignature,
      authorizationHash,
    } = body;

    if (!teamMemberUserId || !Array.isArray(spendingLimits) || !authorizationSignature) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Verify team member is in org
    if (!(await isOrgMember(orgId, teamMemberUserId))) {
      return NextResponse.json(
        { error: 'User is not a member of this organization' },
        { status: 400 }
      );
    }

    const result = await createOrgAccessKey({
      orgId,
      teamMemberUserId,
      spendingLimits: spendingLimits.map((l: { tokenAddress: string; amount: string }) => ({
        tokenAddress: l.tokenAddress,
        amount: BigInt(l.amount),
      })),
      expiryTimestamp: expiryDays ? Math.floor(Date.now() / 1000) + expiryDays * 86400 : undefined,
      authorizationSignature,
      authorizationHash,
      chainId: tempoTestnet.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating org access key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create access key' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organizations/[orgId]/access-keys
 *
 * List all Access Keys for organization (members can view)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { orgId } = await context.params;

    if (!(await isOrgMember(orgId, session.user.id))) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    const keys = await getOrgAccessKeys(orgId);

    return NextResponse.json(
      keys.map((k) => ({
        id: k.id,
        authorizedUser: k.user?.id
          ? {
              id: k.user.id,
              name: k.user.name,
            }
          : null,
        limits: k.limits,
        expiry: k.expiry ? Number(k.expiry) : null,
        status: k.status,
        createdAt: k.createdAt,
      }))
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting org access keys:', error);
    return NextResponse.json({ error: 'Failed to get access keys' }, { status: 500 });
  }
}
