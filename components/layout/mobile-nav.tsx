'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Compass, LayoutDashboard, Menu, Newspaper } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useSession } from '@/lib/auth/auth-client';

const navItems = [
  { name: 'Explore', href: '/explore', icon: Compass },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, requiresAuth: true },
  { name: 'Blog', href: '/blog', icon: Newspaper },
  {
    name: 'Documentation',
    href: process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.grip.dev',
    icon: BookOpen,
    external: true,
  },
];

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  const visibleItems = navItems.filter((item) => !item.requiresAuth || session);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden'
        )}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="pr-0">
        <Link href="/" className="flex items-center space-x-2" onClick={() => setOpen(false)}>
          <span className="font-bold">GRIP</span>
        </Link>
        <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6 overflow-y-auto">
          <div className="flex flex-col space-y-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2 text-foreground/70 transition-colors hover:text-foreground',
                    pathname === item.href && 'text-foreground font-medium'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
