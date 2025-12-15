import { db } from '@/db';
import { accessKeys, activityLog } from '@/db/schema/business';
import { requireAuth } from '@/lib/auth-server';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/access-keys/[id]
 *
 * Revoke an Access Key.
 * This marks the key as revoked and sets revokedAt timestamp.
 * Once revoked, the backend can no longer use this key for signing.
 *
 * Body:
 * - reason?: string (optional reason for revocation)
 *
 * Returns:
 * - accessKey: The revoked access key record
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    // Fetch Access Key to ensure it belongs to the user
    const accessKey = await db.query.accessKeys.findFirst({
      where: and(eq(accessKeys.id, id), eq(accessKeys.userId, session.user.id)),
    });

    if (!accessKey) {
      return NextResponse.json({ error: 'Access Key not found' }, { status: 404 });
    }

    if (accessKey.status === 'revoked') {
      return NextResponse.json({ error: 'Access Key already revoked' }, { status: 400 });
    }

    // Revoke the Access Key
    const [revokedKey] = await db
      .update(accessKeys)
      .set({
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokedReason: reason || 'User revoked',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accessKeys.id, id))
      .returning();

    // Log activity
    await db.insert(activityLog).values({
      eventType: 'access_key_revoked',
      network: accessKey.network,
      userId: session.user.id,
      metadata: {
        accessKeyId: id,
        backendWalletAddress: accessKey.backendWalletAddress,
        reason: reason || 'User revoked',
      },
    });

    return NextResponse.json({ accessKey: revokedKey });
  } catch (error) {
    console.error('[access-keys] Error revoking Access Key:', error);
    return NextResponse.json({ error: 'Failed to revoke Access Key' }, { status: 500 });
  }
}

/**
 * GET /api/access-keys/[id]
 *
 * Get details of a specific Access Key.
 *
 * Returns:
 * - accessKey: The access key record
 * - usage: Usage statistics (if implemented)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth();
    const { id } = await context.params;

    // Fetch Access Key
    const accessKey = await db.query.accessKeys.findFirst({
      where: and(eq(accessKeys.id, id), eq(accessKeys.userId, session.user.id)),
    });

    if (!accessKey) {
      return NextResponse.json({ error: 'Access Key not found' }, { status: 404 });
    }

    // TODO: Fetch usage statistics from activity_log
    // For now, just return the key
    return NextResponse.json({ accessKey });
  } catch (error) {
    console.error('[access-keys] Error fetching Access Key:', error);
    return NextResponse.json({ error: 'Failed to fetch Access Key' }, { status: 500 });
  }
}
