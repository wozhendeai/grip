import { BountyCard } from '@/components/bounty/bounty-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import type { Bounty } from '@/lib/types';

interface SuggestionsProps {
  bounties?: Bounty[];
  title?: string;
  subtitle?: string;
}

export function Suggestions({
  bounties = [],
  title = 'Suggestions',
  subtitle = 'Based on your activity',
}: SuggestionsProps) {
  if (bounties.length === 0) {
    return (
      <Card className="h-full border-border bg-card shadow-sm py-0 gap-0">
        <CardHeader className="border-b border-border bg-muted/40 py-3 px-4">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4">
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyTitle>No suggestions yet</EmptyTitle>
              <EmptyDescription>Check back later for personalized recommendations</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full border-border bg-card shadow-sm py-0 gap-0">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border bg-muted/40 py-3 px-4 space-y-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {subtitle && (
            <span className="text-xs text-muted-foreground font-normal hidden sm:inline-block">
              • {subtitle}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {bounties.map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} variant="row" />
        ))}
      </CardContent>
    </Card>
  );
}
