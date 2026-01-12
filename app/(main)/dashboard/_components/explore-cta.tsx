import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function ExploreCTA() {
  return (
    <Card className="p-4 space-y-3 bg-muted/30 border-dashed">
      <h3 className="text-sm font-medium">Explore</h3>
      <p className="text-xs text-muted-foreground">
        Discover new bounties tailored to your skills in React and TypeScript.
      </p>
      <Button variant="outline" size="sm" className="w-full h-8 text-xs" nativeButton={false} render={<Link href="/explore" />}>
        Explore Bounties
      </Button>
    </Card>
  );
}
