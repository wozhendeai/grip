'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { authClient } from '@/lib/auth/auth-client';
import { ChevronDown, Clock, Github, Mail, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { InviteMemberModal } from './invite-member-modal';
import type { OrgInvitation, OrgMember } from '../_lib/types';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  billingAdmin: 'Billing Admin',
  bountyManager: 'Bounty Manager',
  member: 'Member',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  billingAdmin: 'secondary',
  bountyManager: 'secondary',
  member: 'outline',
};

interface MembersContentProps {
  members: OrgMember[];
  invitations: OrgInvitation[];
  organizationId: string;
  currentUserRole: 'owner' | 'billingAdmin' | 'bountyManager' | 'member';
}

export function MembersContent({
  members,
  invitations,
  organizationId,
  currentUserRole,
}: MembersContentProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrgMember | null>(null);
  const [invitationToCancel, setInvitationToCancel] = useState<OrgInvitation | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [localMembers, setLocalMembers] = useState(members);
  const [localInvitations, setLocalInvitations] = useState(invitations);

  const isOwner = currentUserRole === 'owner';

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await authClient.organization.updateMemberRole({
        memberId,
        role: newRole as 'owner' | 'billingAdmin' | 'bountyManager' | 'member',
      });

      // Update local state
      setLocalMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    try {
      setIsRemoving(true);
      await authClient.organization.removeMember({
        memberIdOrEmail: memberToRemove.id,
      });

      // Update local state
      setLocalMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
      setMemberToRemove(null);
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return;

    try {
      setIsCanceling(true);
      await authClient.organization.cancelInvitation({
        invitationId: invitationToCancel.id,
      });

      setLocalInvitations((prev) => prev.filter((inv) => inv.id !== invitationToCancel.id));
      setInvitationToCancel(null);
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleInviteSuccess = (newInvitation?: OrgInvitation) => {
    if (newInvitation) {
      setLocalInvitations((prev) => [...prev, newInvitation]);
    }
    setIsInviteModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {localMembers.length} {localMembers.length === 1 ? 'member' : 'members'}
            </CardDescription>
          </div>
          {isOwner && (
            <Button size="sm" onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="size-4 mr-2" />
              Invite
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {localMembers.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Users />
              </EmptyMedia>
              <EmptyTitle>No members</EmptyTitle>
              <EmptyDescription>Invite team members to collaborate.</EmptyDescription>
            </Empty>
          ) : (
            <div className="divide-y">
              {localMembers.map((member) => (
                <MemberListItem
                  key={member.id}
                  member={member}
                  isOwner={isOwner}
                  onRoleChange={handleRoleChange}
                  onRemove={() => setMemberToRemove(member)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {localInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              {localInvitations.length} pending {localInvitations.length === 1 ? 'invite' : 'invites'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {localInvitations.map((invitation) => (
                <InvitationListItem
                  key={invitation.id}
                  invitation={invitation}
                  isOwner={isOwner}
                  onCancel={() => setInvitationToCancel(invitation)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <InviteMemberModal
        open={isInviteModalOpen}
        onOpenChange={setIsInviteModalOpen}
        organizationId={organizationId}
        onSuccess={handleInviteSuccess}
      />

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <strong>{memberToRemove?.user?.name || memberToRemove?.user?.email}</strong> from this
              organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? 'Removing...' : 'Remove Member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Invitation Confirmation Dialog */}
      <AlertDialog open={!!invitationToCancel} onOpenChange={() => setInvitationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to{' '}
              <strong>{invitationToCancel?.email}</strong>? They will no longer be able to join this
              organization using this invitation link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Keep Invitation</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? 'Canceling...' : 'Cancel Invitation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface MemberListItemProps {
  member: OrgMember;
  isOwner: boolean;
  onRoleChange: (memberId: string, newRole: string) => void;
  onRemove: () => void;
}

function MemberListItem({ member, isOwner, onRoleChange, onRemove }: MemberListItemProps) {
  const user = member.user;
  const isMemberOwner = member.role === 'owner';
  const isGitHubSynced = member.sourceType === 'github_sync';

  // Owners can change roles of non-owners
  const canChangeRole = isOwner && !isMemberOwner;
  // Owners can remove non-owners
  const canRemove = isOwner && !isMemberOwner;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-10">
          <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? 'Member'} />
          <AvatarFallback>{user?.name?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{user?.name || 'Unknown'}</p>
            <Badge variant={ROLE_VARIANTS[member.role] ?? 'outline'} className="shrink-0">
              {ROLE_LABELS[member.role] ?? member.role}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate">{user?.email}</span>
            {isGitHubSynced && (
              <span className="flex items-center gap-1 shrink-0">
                <Github className="size-3" />
                <span>synced</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canChangeRole && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm">
                  Change Role
                  <ChevronDown className="size-4 ml-1" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRoleChange(member.id, 'billingAdmin')}>
                Billing Admin
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRoleChange(member.id, 'bountyManager')}>
                Bounty Manager
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRoleChange(member.id, 'member')}>
                Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {canRemove && (
          <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive">
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface InvitationListItemProps {
  invitation: OrgInvitation;
  isOwner: boolean;
  onCancel: () => void;
}

function InvitationListItem({ invitation, isOwner, onCancel }: InvitationListItemProps) {
  const isExpired = new Date(invitation.expiresAt) < new Date();

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="size-10">
          <AvatarFallback>
            <Mail className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{invitation.email}</p>
            <Badge variant={ROLE_VARIANTS[invitation.role] ?? 'outline'} className="shrink-0">
              {ROLE_LABELS[invitation.role] ?? invitation.role}
            </Badge>
            {isExpired && (
              <Badge variant="secondary" className="shrink-0">
                Expired
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-3" />
            <span>
              {isExpired
                ? 'Expired'
                : `Expires ${new Date(invitation.expiresAt).toLocaleDateString()}`}
            </span>
          </div>
        </div>
      </div>

      {isOwner && (
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-destructive shrink-0">
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
