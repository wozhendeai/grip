'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MoreHorizontal, CheckCircle2 } from 'lucide-react';

interface AboutDialogProps {
  username: string;
  name: string | null;
  avatarUrl: string | null;
  memberSince: Date | string | null;
  htmlUrl: string;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
}

export function AboutDialog({ username, name, avatarUrl, memberSince, htmlUrl }: AboutDialogProps) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : username.slice(0, 2).toUpperCase();

  const joinedDate = memberSince ? formatDate(new Date(memberSince)) : null;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">About this account</span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>About this account</DialogTitle>
          <DialogDescription>
            Information about {username}'s account connectivity and status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="rounded-full bg-green-500/10 p-2 text-green-600">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="space-y-0.5">
              <div className="font-medium">Identity Synced</div>
              <div className="text-sm text-muted-foreground">
                This account is verified and synced from GitHub.
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-3 border-b py-2">
              <Avatar className="size-8 border border-border">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{name || username}</div>
                <div className="text-xs text-muted-foreground">@{username}</div>
              </div>
            </div>
            {joinedDate && (
              <div className="flex justify-between border-b py-2">
                <span className="text-muted-foreground">Joined</span>
                <span className="font-medium">{joinedDate}</span>
              </div>
            )}
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Profile Link</span>
              <a
                href={htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                github.com/{username}
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
