'use client';

import { Suspense } from 'react';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { NotificationDropdown } from './notification-dropdown';
import { UserNav } from './user-nav';
import { SearchTrigger } from './search-trigger';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <MainNav />
        <MobileNav />
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <SearchTrigger />
          </div>
          <NotificationDropdown />
          <Suspense fallback={<div className="w-8 h-8 rounded-full bg-muted/50 animate-pulse" />}>
            <UserNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
