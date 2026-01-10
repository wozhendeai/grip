'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatTimeAgo } from '@/lib/utils';
import { Building2, ExternalLink, Calendar, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { authClient } from '@/lib/auth/auth-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  githubOrgLogin: string | null;
  createdAt: Date;
}

interface GeneralContentProps {
  organization: Organization;
  isOwner: boolean;
}

export function GeneralContent({ organization, isOwner }: GeneralContentProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteOrg = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    const result = await authClient.organization.delete({
      organizationId: organization.id,
    });

    if (result.error) {
      setDeleteError(result.error.message || 'Failed to delete organization');
      setIsDeleting(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Basic information about this organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              <AvatarImage src={organization.logo ?? undefined} alt={organization.name} />
              <AvatarFallback>
                <Building2 className="size-8" />
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{organization.name || organization.slug}</h3>
              <p className="text-sm text-muted-foreground">@{organization.slug}</p>
              {organization.githubOrgLogin && (
                <Link
                  href={`https://github.com/${organization.githubOrgLogin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  github.com/{organization.githubOrgLogin}
                  <ExternalLink className="size-3" />
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-4 pt-4 border-t">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created</span>
              <span>{formatTimeAgo(organization.createdAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone - Owners only */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions for this organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {deleteError && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {deleteError}
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Delete this organization</p>
                <p className="text-sm text-muted-foreground">
                  Once deleted, all bounties, settings, and member data will be permanently removed.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="destructive" size="sm" disabled={isDeleting}>
                      {isDeleting ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 mr-2" />
                      )}
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>{organization.name}</strong>? This
                      action cannot be undone. All bounties, member records, and settings will be
                      permanently deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteOrg}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Organization'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
