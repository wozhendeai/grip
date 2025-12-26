import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';
import { Eye, FileCode, PlusCircle, Trophy } from 'lucide-react';
import Link from 'next/link';

type EmptyStateVariant = 'created' | 'claimed' | 'watching' | 'completed';

interface DashboardEmptyStateProps {
  variant: EmptyStateVariant;
}

const EMPTY_STATES: Record<
  EmptyStateVariant,
  {
    icon: React.ReactNode;
    title: string;
    description: string;
    cta?: { label: string; href: string };
  }
> = {
  created: {
    icon: <PlusCircle className="h-12 w-12 text-slate-300" />,
    title: 'No bounties created yet',
    description: 'Create a bounty on any GitHub issue to get started.',
    cta: { label: 'Explore Issues', href: '/explore' },
  },
  claimed: {
    icon: <FileCode className="h-12 w-12 text-slate-300" />,
    title: 'No claimed bounties',
    description: 'Browse available bounties and submit a PR to get started.',
    cta: { label: 'Browse Bounties', href: '/explore' },
  },
  watching: {
    icon: <Eye className="h-12 w-12 text-slate-300" />,
    title: 'Watching feature coming soon',
    description: "You'll soon be able to watch bounties and get notified of updates.",
  },
  completed: {
    icon: <Trophy className="h-12 w-12 text-slate-300" />,
    title: 'No completed bounties',
    description: "Your completed bounties will appear here once they're paid out.",
  },
};

/**
 * Empty state for dashboard tabs
 * Uses the existing Empty component with variant-specific content
 */
export function DashboardEmptyState({ variant }: DashboardEmptyStateProps) {
  const state = EMPTY_STATES[variant];

  return (
    <Empty className="border-dashed bg-card/50 py-12">
      <div className="mx-auto mb-4">{state.icon}</div>
      <EmptyHeader>
        <EmptyTitle>{state.title}</EmptyTitle>
        <EmptyDescription>{state.description}</EmptyDescription>
      </EmptyHeader>
      {state.cta && (
        <EmptyContent>
          <Button nativeButton={false} render={<Link href={state.cta.href} />}>
            {state.cta.label}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
