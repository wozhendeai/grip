import Link from 'next/link';
import type { getUserOrganizations } from '@/db/queries/users';

interface MemberOfSectionProps {
  organizations: Awaited<ReturnType<typeof getUserOrganizations>>;
}

/**
 * Member of section - shows organizations the user belongs to
 *
 * Conditional rendering: only displays if user is member of 1+ organizations.
 * Uses grid layout matching other profile sections.
 */
export function MemberOfSection({ organizations }: MemberOfSectionProps) {
  if (!organizations || organizations.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-card/30">
      <div className="container py-8">
        <h2 className="mb-6 text-sm font-medium text-muted-foreground">Member Of</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((membership) => (
            <Link
              key={membership.organization.id}
              href={`/${membership.organization.slug}`}
              className="group block rounded-lg border border-border bg-card p-4 transition-colors hover:border-muted-foreground/50 hover:bg-card/80"
            >
              <div className="flex items-center gap-3">
                {membership.organization.logo && (
                  <img
                    src={membership.organization.logo}
                    alt={membership.organization.name}
                    className="h-10 w-10 rounded-full border border-border object-cover"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <h3 className="font-medium group-hover:text-muted-foreground transition-colors truncate">
                    {membership.organization.name}
                  </h3>
                  {membership.organization.githubOrgLogin && (
                    <p className="text-xs text-muted-foreground truncate">
                      @{membership.organization.githubOrgLogin}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
