'use client';

import { CommandMenu } from '@/components/command-menu';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from '@/lib/auth-client';
import { BookOpen, LogOut, Search, Settings, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NavbarBalance } from './navbar-balance';

/**
 * Navbar - Enhanced with theme toggle
 *
 * Design decisions:
 * - Minimal navigation with Explore and Bounties links
 * - User dropdown with structured sections (like MeritSystems):
 *   1. User info header
 *   2. Navigation links (Your Profile, Dashboard)
 *   3. Theme toggle row
 *   4. Settings, Documentation links
 *   5. Sign out
 * - Theme toggle uses 3-button pattern (light/dark/system)
 */
export function Navbar() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Fetch user's wallet address when session loads
  useEffect(() => {
    async function fetchWallet() {
      if (session?.user?.id) {
        try {
          const res = await fetch('/api/user/passkeys');
          if (res.ok) {
            const data = await res.json();
            const wallet = data.passkeys?.find((p: { tempoAddress: string }) => p.tempoAddress);
            if (wallet) {
              setWalletAddress(wallet.tempoAddress);
            }
          }
        } catch (err) {
          console.error('Failed to fetch wallet:', err);
        }
      } else {
        setWalletAddress(null);
      }
    }

    fetchWallet();
  }, [session?.user?.id]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      {/* Command Menu - controlled from navbar */}
      <CommandMenu open={commandMenuOpen} onOpenChange={setCommandMenuOpen} />

      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <nav className="container flex h-16 items-center justify-between">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link
              href="/"
              className="font-bold text-lg tracking-tight hover:text-muted-foreground transition-colors"
            >
              BountyLane
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="/explore"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Explore
              </Link>
              <Link
                href="/bounties"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Bounties
              </Link>
            </div>
          </div>

          {/* Right: Command Menu + Balance + Auth */}
          <div className="flex items-center gap-4">
            {/* Command Menu Trigger */}
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => setCommandMenuOpen(true)}
            >
              <Search className="h-4 w-4" />
              <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium hidden sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            {/* Balance Display (only when logged in with wallet) */}
            {!isPending && session?.user && walletAddress && (
              <NavbarBalance walletAddress={walletAddress} />
            )}

            {/* Notification Bell (only when logged in) */}
            {!isPending && session?.user && <NotificationDropdown />}

            {isPending ? (
              <>
                {/* Balance skeleton */}
                <div className="hidden sm:flex items-center">
                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                </div>
                {/* Avatar skeleton */}
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              </>
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      className="relative h-9 w-9 rounded-full ring-1 ring-border hover:ring-primary transition-all"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={session.user.image ?? undefined}
                          alt={session.user.name ?? 'User'}
                        />
                        <AvatarFallback className="bg-secondary text-xs">
                          {session.user.name?.charAt(0).toUpperCase() ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-64">
                  {/* User Info Header */}
                  <div className="flex items-center gap-3 p-3 border-b border-border">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={session.user.image ?? undefined}
                        alt={session.user.name ?? 'User'}
                      />
                      <AvatarFallback className="bg-secondary">
                        {session.user.name?.charAt(0).toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{session.user.name}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {session.user.email}
                      </span>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="p-1">
                    <DropdownMenuItem
                      render={<Link href={`/u/${session.user.name}`} className="cursor-pointer" />}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Your Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/wallet" className="cursor-pointer" />}>
                      <Wallet className="mr-2 h-4 w-4" />
                      Wallet
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Theme Toggle */}
                  <div className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Theme</span>
                      <ThemeToggle />
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Settings & Links */}
                  <div className="p-1">
                    <DropdownMenuItem render={<Link href="/settings" className="cursor-pointer" />}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      render={(props) => (
                        <a
                          {...props}
                          href="https://github.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer"
                        />
                      )}
                    >
                      <BookOpen className="mr-2 h-4 w-4" />
                      Documentation
                    </DropdownMenuItem>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Sign Out */}
                  <div className="p-1">
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-muted-foreground hover:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button render={<Link href="/login" />} size="sm" className="font-medium">
                Sign In
              </Button>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
