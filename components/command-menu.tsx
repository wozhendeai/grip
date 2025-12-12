'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { MagnifyingGlassIcon, RocketIcon, BackpackIcon } from '@radix-ui/react-icons';

interface CommandMenuProps {
  /** Controlled open state (optional - uses internal state if not provided) */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Global Command Menu (cmd+k)
 *
 * Provides quick navigation and actions across the app.
 * Can be controlled externally via open/onOpenChange props,
 * or used standalone with internal state.
 *
 * Sections:
 * - Quick Actions: Common tasks
 * - Navigation: Main pages
 */
export function CommandMenu({ open: controlledOpen, onOpenChange }: CommandMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const router = useRouter();

  // Use controlled state if provided, otherwise internal
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!isOpen);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, setOpen]);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [setOpen]
  );

  return (
    <CommandDialog open={isOpen} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => runCommand(() => router.push('/bounties'))}>
            <RocketIcon className="mr-2" />
            View All Bounties
            <CommandShortcut>B</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/wallet'))}>
            <BackpackIcon className="mr-2" />
            Open Wallet
            <CommandShortcut>W</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/explore'))}>
            <MagnifyingGlassIcon className="mr-2" />
            Explore Projects
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
