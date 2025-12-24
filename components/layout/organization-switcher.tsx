'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { authClient, useSession } from '@/lib/auth/auth-client';
import { Building2, Check } from 'lucide-react';
import { useEffect, useState } from 'react';

// Organization type from Better Auth
interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  createdAt: Date;
}

/**
 * OrganizationSwitcher - Switch between personal and organization contexts
 *
 * Features:
 * - Shows personal account + all organizations user belongs to
 * - Active indicator (checkmark) on current context
 * - Click to switch context immediately
 *
 * Data fetching:
 * - Uses Better Auth's organization.list() method
 * - Updates in real-time when orgs change
 *
 * Context switching:
 * - Personal: activeOrganizationId = null
 * - Organization: activeOrganizationId = org.id
 */
export function OrganizationSwitcher() {
  const { data: session } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch organizations and active org on mount
  useEffect(() => {
    async function fetchOrganizations() {
      if (!session?.user) return;

      try {
        const data = await authClient.organization.list();
        // Better Auth returns array directly
        const orgs = Array.isArray(data) ? data : [];
        setOrganizations(orgs);
        // Active org is stored in session object
        setActiveOrgId(session?.session?.activeOrganizationId || null);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrganizations();
  }, [session?.user, session?.session?.activeOrganizationId]);

  // Switch organization context
  async function handleSwitch(orgId: string | null) {
    try {
      await authClient.organization.setActive({ organizationId: orgId });
      setActiveOrgId(orgId);
      // Refresh page to update org-specific data
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch organization:', error);
    }
  }

  const isPersonalActive = activeOrgId === null;

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-12 bg-muted/50 rounded-md animate-pulse" />
        <div className="h-12 bg-muted/50 rounded-md animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Personal Account Row */}
      <button
        type="button"
        onClick={() => handleSwitch(null)}
        className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
      >
        <Avatar className="h-8 w-8 mt-0.5">
          <AvatarImage src={session?.user?.image ?? undefined} />
          <AvatarFallback className="text-xs">
            {session?.user?.name?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">@{session?.user?.name}</span>
            {isPersonalActive && <Check className="h-4 w-4 text-primary shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground">Personal account</span>
        </div>
      </button>

      {/* Organization Rows */}
      {organizations.map((org) => {
        const isActive = activeOrgId === org.id;

        return (
          <button
            key={org.id}
            type="button"
            onClick={() => handleSwitch(org.id)}
            className="w-full flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
          >
            {org.logo ? (
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarImage src={org.logo} />
                <AvatarFallback className="text-xs">
                  {org.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center mt-0.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{org.name}</span>
                {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
