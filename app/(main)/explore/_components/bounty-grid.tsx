import { BountyCard } from '@/components/bounty/bounty-card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import type { Bounty } from '@/lib/types';

interface BountyGridProps {
  bounties: Bounty[];
}

export function BountyGrid({ bounties }: BountyGridProps) {
  if (bounties.length === 0) {
    return (
      <Empty className="border-border bg-card/50">
        <EmptyHeader>
          <EmptyTitle>No bounties found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your filters or check back later for new opportunities.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {bounties.map((bounty, index) => (
        <BountyCard key={bounty.id} bounty={bounty} index={index} />
      ))}
    </div>
  );
}
