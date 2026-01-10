import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { requireAuth } from '@/lib/auth/auth-server';
import { revokeAccessKeyById } from '@/lib/tempo/access-keys';
import { getOrgAccessKeyById } from '@/db/queries/access-keys';
import { headers } from 'next/headers';

type RouteContext = {
  params: Promise<{ orgId: string; keyId: string }>;
};

/**
 * DELETE /api/organizations/[orgId]/access-keys/[keyId]
 *
 * Revoke organization Access Key (owner only)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    await requireAuth();
    const { orgId, keyId } = await context.params;

    const headersList = await headers();
    const hasDeletePermission = await auth.api.hasPermission({
      headers: headersList,
      body: { permissions: { organization: ['delete'] }, organizationId: orgId },
    });

    if (!hasDeletePermission?.success) {
      return NextResponse.json(
        { error: 'Only organization owner can revoke Access Keys' },
        { status: 403 }
      );
    }

    const accessKey = await getOrgAccessKeyById(keyId, orgId);
    if (!accessKey) {
      return NextResponse.json({ error: 'Access Key not found' }, { status: 404 });
    }

    await revokeAccessKeyById(keyId, 'Revoked by owner');
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error revoking org access key:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revoke access key' },
      { status: 500 }
    );
  }
}
