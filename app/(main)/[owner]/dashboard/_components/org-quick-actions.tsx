import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Settings } from 'lucide-react';
import Link from 'next/link';

interface OrgQuickActionsProps {
  orgSlug: string;
}

export function OrgQuickActions({ orgSlug }: OrgQuickActionsProps) {
  return (
    <Card className="bg-muted/30 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start" nativeButton={false} render={<Link href={`/${orgSlug}/settings/wallet`} />}>
          <Wallet className="size-3.5 mr-2" />
          Add Funds
        </Button>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs justify-start" nativeButton={false} render={<Link href={`/${orgSlug}/settings`} />}>
          <Settings className="size-3.5 mr-2" />
          Org Settings
        </Button>
      </CardContent>
    </Card>
  );
}
