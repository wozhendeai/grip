'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus, Plus } from 'lucide-react';
import type { organization } from '@/db/schema/auth';
import type { GitHubOrganizationMinimal } from '@/lib/github';
import type { OrgDashboardRepo } from '@/db/queries/org-dashboard';
import { CreateBountyModal } from './create-bounty-modal';
import { InviteMemberModal } from '../../settings/_components/invite-member-modal';

interface OrgDashboardHeaderProps {
  org: typeof organization.$inferSelect;
  github: GitHubOrganizationMinimal | null;
  memberCount: number;
  repos: OrgDashboardRepo[];
}

export function OrgDashboardHeader({ org, github, memberCount, repos }: OrgDashboardHeaderProps) {
  const router = useRouter();
  const [showBountyModal, setShowBountyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const avatarUrl = org.logo || github?.avatar_url || '';
  const description = github?.description || null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <Avatar className="size-14 border border-border shrink-0">
          <AvatarImage src={avatarUrl} alt={org.name} />
          <AvatarFallback className="text-lg font-semibold">
            {org.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
            <Badge variant="secondary" className="text-xs">
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Badge>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => setShowInviteModal(true)}>
          <UserPlus className="size-4 mr-1.5" />
          Add Member
        </Button>
        <Button size="sm" onClick={() => setShowBountyModal(true)}>
          <Plus className="size-4 mr-1.5" />
          Create Bounty
        </Button>
      </div>

      <InviteMemberModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        organizationId={org.id}
        onSuccess={() => router.refresh()}
      />

      <CreateBountyModal
        open={showBountyModal}
        onOpenChange={setShowBountyModal}
        repos={repos}
        orgSlug={org.slug}
      />
    </div>
  );
}
