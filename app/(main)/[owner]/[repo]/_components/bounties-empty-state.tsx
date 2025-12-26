import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { DollarSign } from 'lucide-react';

interface BountiesEmptyStateProps {
  isClaimed: boolean;
}

export function BountiesEmptyState({ isClaimed }: BountiesEmptyStateProps) {
  return (
    <Empty className="border-border bg-card/50">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <DollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>No bounties yet</EmptyTitle>
        <EmptyDescription>Be the first to fund work on this repository</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
