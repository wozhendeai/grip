'use client';

import { CommandMenu } from '@/components/command-menu';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from '@/components/ui/navigation-menu';
import { authClient, signOut, useSession } from '@/lib/auth/auth-client';
import {
  BookOpen,
  Building2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User,
  Wallet,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CreateOrganizationModal } from '@/components/organization/create-organization-modal';
import { OrganizationSwitcher } from './organization-switcher';
import { NavbarBalance } from './navbar-balance';

/**
 * Navbar - Enhanced with theme toggle
 *
 * Design decisions:
 * - Minimal navigation with Explore and Bounties links
 * - User dropdown with streamlined structure:
 *   1. User info header
 *   2. Theme toggle
 *   3. Navigation links (Your Profile, Wallet, Settings, Documentation)
 *   4. Organization switcher (with section label)
 *   5. Sign out
 * - Theme toggle uses 3-button pattern (light/dark/system)
 */
export function Navbar() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Fetch user's wallet address when session loads
  useEffect(() => {
    async function fetchWallet() {
      if (session?.user?.id) {
        try {
          const res = await fetch('/api/auth/tempo/passkeys');
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

      {/* Create Organization Modal */}
      <CreateOrganizationModal open={createOrgModalOpen} onOpenChange={setCreateOrgModalOpen} />

      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <nav className="container flex h-16 items-center justify-between">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link
              href="/"
              className="font-bold text-lg tracking-tight hover:text-muted-foreground transition-colors"
            >
              GRIP
            </Link>

            {/* Nav Links - Using NavigationMenu for accessibility and keyboard navigation */}
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList className="gap-6">
                <NavigationMenuItem>
                  <NavigationMenuLink
                    href="/explore"
                    active={pathname === '/explore'}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors data-[active=true]:text-foreground data-[active=true]:font-semibold"
                  >
                    Explore
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    href="/dashboard"
                    active={pathname === '/dashboard'}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors data-[active=true]:text-foreground data-[active=true]:font-semibold"
                  >
                    Dashboard
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
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
              <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium hidden sm:flex">
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
                      className="h-12 justify-start px-2 gap-2"
                      data-testid="user-menu-trigger"
                    >
                      {activeOrganization ? (
                        activeOrganization.logo ? (
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={activeOrganization.logo}
                              alt={activeOrganization.name}
                            />
                            <AvatarFallback className="text-xs">
                              {activeOrganization.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )
                      ) : (
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={session.user.image ?? undefined}
                            alt={session.user.name ?? 'User'}
                          />
                          <AvatarFallback className="text-xs">
                            {session.user.name?.charAt(0).toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {activeOrganization?.name || session.user.name || 'User'}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {activeOrganization ? 'Organization' : session.user.email}
                        </span>
                      </div>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-64">
                  {/* Theme */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Sun className="mr-2 h-4 w-4" />
                      Theme
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                          <DropdownMenuRadioItem value="light">
                            <Sun className="mr-2 h-4 w-4" />
                            Light
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="dark">
                            <Moon className="mr-2 h-4 w-4" />
                            Dark
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="system">
                            <Monitor className="mr-2 h-4 w-4" />
                            System
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {/* Navigation */}
                  <DropdownMenuItem
                    render={
                      <Link
                        href={`/${session.user.name}`}
                        className="flex items-center gap-2 cursor-pointer"
                      />
                    }
                  >
                    <User className="mr-2 h-4 w-4" />
                    Your Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link href="/wallet" className="flex items-center gap-2 cursor-pointer" />
                    }
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Wallet
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link href="/settings" className="flex items-center gap-2 cursor-pointer" />
                    }
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link
                        href={process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.grip.dev'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 cursor-pointer"
                      />
                    }
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    Docs
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Organization Switcher */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <User className="mr-2 h-4 w-4" />
                      Switch Organization
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <OrganizationSwitcher />
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setCreateOrgModalOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          Create organization
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {/* Sign Out */}
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    variant="destructive"
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                nativeButton={false}
                render={<Link href="/login" />}
                size="sm"
                className="font-medium"
              >
                Sign In
              </Button>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
