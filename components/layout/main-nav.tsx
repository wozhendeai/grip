'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { BookOpen, Compass, Globe, LayoutDashboard, Newspaper } from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';

const resources = [
  {
    title: 'Documentation',
    href: process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.grip.dev',
    description: 'Start building with GRIP. Integration guides and API reference.',
    icon: BookOpen,
    external: true,
  },
  {
    title: 'Blog',
    href: '/blog',
    description: 'Latest updates, guides, and stories from the team.',
    icon: Newspaper,
    external: false,
  },
  {
    title: 'Community',
    href: 'https://twitter.com/usegrip',
    description: 'Join the conversation on Twitter and Discord.',
    icon: Globe,
    external: true,
  },
];

export function MainNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="mr-4 hidden md:flex">
      <Link href="/" className="mr-6 flex items-center space-x-2">
        <span className="hidden font-bold sm:inline-block">GRIP</span>
      </Link>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink
              render={<Link href="/explore" />}
              data-active={pathname === '/explore'}
              className={cn(navigationMenuTriggerStyle(), 'bg-transparent')}
            >
              <Compass className="mr-1.5 h-4 w-4" />
              Explore
            </NavigationMenuLink>
          </NavigationMenuItem>
          {session && (
            <NavigationMenuItem>
              <NavigationMenuLink
                render={<Link href="/dashboard" />}
                data-active={pathname === '/dashboard'}
                className={cn(navigationMenuTriggerStyle(), 'bg-transparent')}
              >
                <LayoutDashboard className="mr-1.5 h-4 w-4" />
                Dashboard
              </NavigationMenuLink>
            </NavigationMenuItem>
          )}
          <NavigationMenuItem>
            <NavigationMenuTrigger className="bg-transparent">Resources</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                {resources.map((item) => (
                  <ListItem
                    key={item.title}
                    title={item.title}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noreferrer' : undefined}
                    icon={item.icon}
                  >
                    {item.description}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & { icon?: React.ElementType }
>(({ className, title, children, icon: Icon, href, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink
        render={<a ref={ref} href={href} {...props} />}
        className={cn(
          'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium leading-none">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          {title}
        </div>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1.5">{children}</p>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
