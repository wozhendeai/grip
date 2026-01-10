import { auth } from '@/lib/auth/auth';
import { getSession } from '@/lib/auth/auth-server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { GeneralContent } from './_components/general-content';

interface OrgSettingsPageProps {
  params: Promise<{ owner: string }>;
}

/**
 * Organization settings - General page
 *
 * Route: /[org-slug]/settings
 *
 * Displays organization details and danger zone.
 * Accessible to all org members.
 */
export default async function OrgSettingsPage({ params }: OrgSettingsPageProps) {
  const { owner } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/settings`);
  }

  const headersList = await headers();
  const result = await auth.api.getFullOrganization({
    headers: headersList,
    query: { organizationSlug: owner },
  });

  if (!result) {
    notFound();
  }

  const membership = result.members.find((m) => m.userId === session.user.id);
  if (!membership) {
    return (
      <div className="py-8 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">You are not a member of this organization.</p>
      </div>
    );
  }

  const org = result as typeof result & { githubOrgLogin?: string | null };
  const isOwner = membership.role === 'owner';

  return (
    <GeneralContent
      organization={{
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo ?? null,
        githubOrgLogin: org.githubOrgLogin ?? null,
        createdAt: org.createdAt,
      }}
      isOwner={isOwner}
    />
  );
}
