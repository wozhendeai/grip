import { requireAuth } from '@/lib/auth-server';
import {
  createRepoSettings,
  getRepoSettingsByGithubRepoId,
  getRepoSettingsByUser,
} from '@/lib/db/queries/repo-settings';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await requireAuth();
    const repoSettings = await getRepoSettingsByUser(session.user.id);

    return NextResponse.json({ repoSettings });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching repo settings:', error);
    return NextResponse.json({ error: 'Failed to fetch repo settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { githubRepoId, githubOwner, githubRepo } = body;

    // Validate required fields
    if (!githubRepoId || !githubOwner || !githubRepo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if repo settings already exist
    const existing = await getRepoSettingsByGithubRepoId(githubRepoId);
    if (existing) {
      return NextResponse.json(
        { error: 'Repo settings already exist', repoSettings: existing },
        { status: 409 }
      );
    }

    const repoSettings = await createRepoSettings({
      verifiedOwnerUserId: session.user.id,
      githubRepoId,
      githubOwner,
      githubRepo,
    });

    return NextResponse.json({ repoSettings }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating repo settings:', error);
    return NextResponse.json({ error: 'Failed to create repo settings' }, { status: 500 });
  }
}
