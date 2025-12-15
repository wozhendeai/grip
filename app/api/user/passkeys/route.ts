import { requireAuth } from '@/lib/auth-server';
import { getPasskeysByUser } from '@/lib/db/queries/passkeys';
import { NextResponse } from 'next/server';

/**
 * GET /api/user/passkeys
 * Returns the current user's passkeys with their tempo addresses
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const passkeys = await getPasskeysByUser(session.user.id);

    return NextResponse.json({ passkeys });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching user passkeys:', error);
    return NextResponse.json({ error: 'Failed to fetch passkeys' }, { status: 500 });
  }
}
