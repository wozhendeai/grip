import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, GitFork, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

export function QuickActions() {
  return (
    <Card className="h-full border-border bg-card shadow-sm py-0 gap-0">
      <CardHeader className="border-b border-border bg-muted/40 py-3 px-4">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col">
          <ActionItem
            href="/bounties/new"
            icon={Plus}
            label="Create Bounty"
            description="Fund an issue to get it solved"
          />
          <ActionItem
            href="/settings/repos"
            icon={GitFork}
            label="Import Repository"
            description="Add your GitHub repos to GRIP"
          />
          <ActionItem
            href="/settings/organizations"
            icon={Users}
            label="Join Organization"
            description="Collaborate with your team"
          />
          <ActionItem
            href="/explore"
            icon={Search}
            label="Browse Bounties"
            description="Find work to do"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActionItem({
  href,
  icon: Icon,
  label,
  description,
}: { href: string; icon: LucideIcon; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
    >
      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}
