'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/auth/auth-client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { OrgInvitation, OrgRole } from '../_lib/types';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: (invitation?: OrgInvitation) => void;
}

type InviteRole = 'member' | 'bountyManager' | 'billingAdmin';

const ROLE_OPTIONS: { value: InviteRole; label: string; description: string }[] = [
  {
    value: 'member',
    label: 'Member',
    description: 'Can view organization details and bounties',
  },
  {
    value: 'bountyManager',
    label: 'Bounty Manager',
    description: 'Can create and manage bounties',
  },
  {
    value: 'billingAdmin',
    label: 'Billing Admin',
    description: 'Can manage wallet and financial operations',
  },
];

export function InviteMemberModal({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setIsSubmitting(true);

      const result = await authClient.organization.inviteMember({
        organizationId,
        email: email.trim(),
        role,
      });

      // Reset form
      setEmail('');
      setRole('member');

      // Pass back the created invitation
      if (result.data) {
        const inv = result.data;
        onSuccess?.({
          id: inv.id,
          email: inv.email,
          role: inv.role as OrgRole,
          status: inv.status as 'pending',
          expiresAt: inv.expiresAt,
          inviterId: inv.inviterId,
        });
      } else {
        onSuccess?.();
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to invite member:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form on close
      setEmail('');
      setRole('member');
      setError(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join this organization. They&apos;ll receive an email with
            instructions to accept.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-auto min-w-[280px]">
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col items-start">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Owner role can only be transferred, not assigned via invitation.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
