'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Search } from 'lucide-react';
import Link from 'next/link';
import type { ClaimedBountyListItem } from '@/db/queries/bounties';

type ActiveWorkCardProps = {
  submissions: ClaimedBountyListItem[];
};

function getStatusDisplay(status: string) {
  switch (status) {
    case 'pending':
      return { label: 'in_progress', variant: 'secondary' as const };
    case 'approved':
    case 'merged':
      return { label: 'submitted', variant: 'outline' as const };
    default:
      return { label: status, variant: 'outline' as const };
  }
}

export function ActiveWorkCard({ submissions }: ActiveWorkCardProps) {
  if (submissions.length === 0) {
    return (
      <section className="space-y-3">
        <h3 className="text-sm font-semibold px-1">Active Work</h3>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="h-10 w-10">
                  <Search className="size-5" strokeWidth={1.5} />
                </EmptyMedia>
                <EmptyTitle>No active claims</EmptyTitle>
                <EmptyDescription className="mb-4">
                  Browse bounties to find work
                </EmptyDescription>
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/explore" />}>
                  <Search className="size-4 mr-2" strokeWidth={2} />
                  Explore Bounties
                </Button>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold px-1">Active Work</h3>
      <Card className="py-0">
        <CardContent className="p-0">
          {submissions.map((item, index) => {
            const statusDisplay = getStatusDisplay(item.submission.status);
            return (
              <Link
                key={item.submission.id}
                href={`/${item.bounty.githubOwner}/${item.bounty.githubRepo}/bounties/${item.bounty.id}`}
                className={`p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors block ${
                  index !== submissions.length - 1 ? 'border-b' : ''
                }`}
              >
                <div className="mt-1 size-4 rounded-full border-2 border-yellow-500/50 bg-yellow-500/10 flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-yellow-500" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium truncate">{item.bounty.title}</p>
                    <Badge variant={statusDisplay.variant} className="shrink-0 text-[10px] h-5">
                      {statusDisplay.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.bounty.githubFullName} #{item.bounty.githubIssueNumber}
                  </p>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
