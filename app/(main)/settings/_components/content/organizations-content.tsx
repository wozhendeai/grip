'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateOrganizationFlow } from '../organizations/create-organization-flow';
import { CreateOrganizationModal } from '../organizations/create-organization-modal';
import { authClient } from '@/lib/auth/auth-client';
import {
  Building2,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  LogOut,
  Mail,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export interface OrganizationMembership {
  id: string;
  role: string;
  organization: {
    id: string;
    name: string | null;
    slug: string;
    logo: string | null;
    githubOrgLogin: string | null;
  };
}

// Invitation type matching better-auth's listUserInvitations response
export interface PendingInvitation {
  id: string;
  role: string | null;
  expiresAt: Date;
  organizationId: string;
  organizationName: string | null;
}

export interface OrganizationsContentProps {
  memberships: OrganizationMembership[];
  isModal?: boolean;
}

const ADMIN_ROLES = ['owner', 'admin', 'billingAdmin', 'bountyManager'];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  billingAdmin: 'Billing Admin',
  bountyManager: 'Bounty Manager',
  member: 'Member',
};

type View = 'main' | 'create';

export function OrganizationsContent({
  memberships,
  isModal = false,
}: OrganizationsContentProps) {
  const router = useRouter();
  const [view, setView] = useState<View>('main');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [localMemberships, setLocalMemberships] = useState(memberships);
  const [localInvitations, setLocalInvitations] = useState<PendingInvitation[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(true);

  // Fetch invitations client-side using better-auth API
  useEffect(() => {
    async function fetchInvitations() {
      try {
        const result = await authClient.organization.listUserInvitations();
        if (result.data) {
          setLocalInvitations(
            result.data.map((inv) => ({
              id: inv.id,
              role: inv.role,
              expiresAt: new Date(inv.expiresAt),
              organizationId: inv.organizationId,
              organizationName: inv.organizationName,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch invitations:', error);
      } finally {
        setIsLoadingInvitations(false);
      }
    }
    fetchInvitations();
  }, []);

  const handleCreateSuccess = () => {
    setView('main');
    setIsCreateModalOpen(false);
    router.refresh();
  };

  const handleLeaveSuccess = (orgId: string) => {
    setLocalMemberships((prev) => prev.filter((m) => m.organization.id !== orgId));
  };

  const handleInvitationAction = (invitationId: string) => {
    setLocalInvitations((prev) => prev.filter((i) => i.id !== invitationId));
  };

  const handleCreateClick = () => {
    if (isModal) {
      setView('create');
    } else {
      setIsCreateModalOpen(true);
    }
  };

  // Inline create flow for modal mode
  if (isModal && view === 'create') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView('main')} className="-ml-2">
          ← Back
        </Button>
        <CreateOrganizationFlow onSuccess={handleCreateSuccess} showHeader />
      </div>
    );
  }

  // Main content (works for both modal and full page)
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage your organization memberships</p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="size-4 mr-2" />
          Create Organization
        </Button>
      </div>

      <Tabs defaultValue="memberships">
        <TabsList>
          <TabsTrigger value="memberships">
            My Organizations
            {localMemberships.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {localMemberships.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            Pending Invitations
            {isLoadingInvitations ? (
              <Loader2 className="ml-2 h-3 w-3 animate-spin" />
            ) : localInvitations.length > 0 ? (
              <Badge variant="secondary" className="ml-2">
                {localInvitations.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="memberships" className="mt-6">
          <MyOrganizationsTab memberships={localMemberships} onLeaveSuccess={handleLeaveSuccess} />
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          <PendingInvitationsTab
            invitations={localInvitations}
            isLoading={isLoadingInvitations}
            onInvitationAction={handleInvitationAction}
          />
        </TabsContent>
      </Tabs>
    </>
  );

  // Full page mode: wrap in max-w container and include modal
  if (!isModal) {
    return (
      <div className="max-w-2xl space-y-6">
        {content}
        <CreateOrganizationModal
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          onSuccess={handleCreateSuccess}
        />
      </div>
    );
  }

  // Modal mode: no container wrapper needed
  return <div className="space-y-6">{content}</div>;
}

interface MyOrganizationsTabProps {
  memberships: OrganizationMembership[];
  onLeaveSuccess: (orgId: string) => void;
}

function MyOrganizationsTab({ memberships, onLeaveSuccess }: MyOrganizationsTabProps) {
  const router = useRouter();
  const [orgToLeave, setOrgToLeave] = useState<OrganizationMembership | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleLeaveOrg = async () => {
    if (!orgToLeave) return;

    try {
      setIsLeaving(true);
      await authClient.organization.leave({
        organizationId: orgToLeave.organization.id,
      });

      onLeaveSuccess(orgToLeave.organization.id);
      setOrgToLeave(null);
      router.refresh();
    } catch (error) {
      console.error('Failed to leave organization:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  if (memberships.length === 0) {
    return (
      <Card className="py-0 gap-0">
        <CardContent className="py-12">
          <Empty>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No Organizations</EmptyTitle>
            <EmptyDescription>
              You are not a member of any organizations yet. Create one or wait for an invitation.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {memberships.map((membership) => {
          const org = membership.organization;
          const isOwner = membership.role === 'owner';
          const canManage = ADMIN_ROLES.includes(membership.role);

          return (
            <Card
              key={org.id}
              className="hover:border-muted-foreground/50 transition-colors py-0 gap-0"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <Link
                    href={`/${org.slug}`}
                    className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="size-10">
                      <AvatarImage src={org.logo ?? undefined} alt={org.name ?? org.slug} />
                      <AvatarFallback>
                        <Building2 className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{org.name || org.slug}</h3>
                        <Badge variant="secondary" className="text-xs capitalize shrink-0">
                          {ROLE_LABELS[membership.role] ?? membership.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">@{org.slug}</p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    {org.githubOrgLogin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={
                          <Link
                            href={`https://github.com/${org.githubOrgLogin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-4" />
                          </Link>
                        }
                      />
                    )}
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={
                          <Link href={`/${org.slug}/settings`} replace>
                            <Settings className="size-4 mr-2" />
                            Manage
                          </Link>
                        }
                      />
                    )}
                    {!isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setOrgToLeave(membership)}
                      >
                        <LogOut className="size-4 mr-2" />
                        Leave
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!orgToLeave} onOpenChange={() => setOrgToLeave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave{' '}
              <strong>{orgToLeave?.organization.name || orgToLeave?.organization.slug}</strong>? You
              will lose access to all organization resources and will need to be invited again to
              rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrg}
              disabled={isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? 'Leaving...' : 'Leave Organization'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface PendingInvitationsTabProps {
  invitations: PendingInvitation[];
  isLoading: boolean;
  onInvitationAction: (invitationId: string) => void;
}

function PendingInvitationsTab({
  invitations,
  isLoading,
  onInvitationAction,
}: PendingInvitationsTabProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAccept = async (invitationId: string) => {
    try {
      setProcessingId(invitationId);
      await authClient.organization.acceptInvitation({
        invitationId,
      });

      onInvitationAction(invitationId);
      router.refresh();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    try {
      setProcessingId(invitationId);
      await authClient.organization.rejectInvitation({
        invitationId,
      });

      onInvitationAction(invitationId);
    } catch (error) {
      console.error('Failed to decline invitation:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatExpiry = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days <= 0) return 'Expired';
    if (days === 1) return 'Expires tomorrow';
    return `Expires in ${days} days`;
  };

  if (isLoading) {
    return (
      <Card className="py-0 gap-0">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span>Loading invitations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card className="py-0 gap-0">
        <CardContent className="py-12">
          <Empty>
            <EmptyMedia variant="icon">
              <Mail />
            </EmptyMedia>
            <EmptyTitle>No Pending Invitations</EmptyTitle>
            <EmptyDescription>
              You don&apos;t have any pending organization invitations.
            </EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => {
        const isProcessing = processingId === invitation.id;

        return (
          <Card
            key={invitation.id}
            className="hover:border-muted-foreground/50 transition-colors py-0 gap-0"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10">
                    <AvatarFallback>
                      <Building2 className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-medium truncate">
                      {invitation.organizationName || 'Organization'}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Invited as:</span>
                      <Badge variant="secondary" className="text-xs">
                        {ROLE_LABELS[invitation.role ?? 'member'] ?? invitation.role ?? 'Member'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatExpiry(invitation.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDecline(invitation.id)}
                    disabled={isProcessing}
                  >
                    <X className="size-4 mr-1" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invitation.id)}
                    disabled={isProcessing}
                  >
                    <Check className="size-4 mr-1" />
                    {isProcessing ? 'Accepting...' : 'Accept'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
