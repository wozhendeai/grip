'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Building2, Plus } from 'lucide-react';
import Link from 'next/link';
import { AddOrgModal } from './add-org-modal';

type OrgMembership = {
  organization: {
    id: string;
    name: string;
    logo: string | null;
    slug: string;
    githubOrgLogin: string | null;
  };
};

type OrganizationsCardProps = {
  organizations: OrgMembership[];
};

export function OrganizationsCard({ organizations }: OrganizationsCardProps) {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-muted-foreground">Organizations</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-sm"
          onClick={() => setShowAddModal(true)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-1">
        {organizations.length === 0 ? (
          <Empty className="border-0 p-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 className="size-4" />
              </EmptyMedia>
              <EmptyTitle>No organizations</EmptyTitle>
              <EmptyDescription>Create or sync an org</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          organizations.map((membership) => (
            <Button
              key={membership.organization.id}
              variant="ghost"
              className="w-full justify-start gap-2 h-9 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              nativeButton={false}
              render={<Link href={`/${membership.organization.slug}`} />}
            >
              {membership.organization.logo ? (
                <Avatar className="size-5">
                  <AvatarImage src={membership.organization.logo} alt={membership.organization.name} />
                  <AvatarFallback className="text-[10px]">
                    {membership.organization.name[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                  @
                </div>
              )}
              {membership.organization.githubOrgLogin ?? membership.organization.slug}
            </Button>
          ))
        )}
      </div>
      <AddOrgModal open={showAddModal} onOpenChange={setShowAddModal} />
    </div>
  );
}
