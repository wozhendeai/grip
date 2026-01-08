'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { UserAvatar } from '@/components/ui/avatar';
import { Building2, ChevronsUpDown, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/auth-client';
import { settingsNavGroups } from './settings-nav-items';

type Organization = {
  id: string;
  name: string | null;
  logo: string | null;
  slug: string;
  role: string;
};

type SettingsSidebarProps = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  organizations: Organization[];
  /** Use "none" for modal context (relative positioning) */
  collapsible?: 'offExamples' | 'icon' | 'none';
  variant?: 'sidebar' | 'floating' | 'inset';
};

export function SettingsSidebar({
  user,
  organizations,
  collapsible,
  variant = 'inset',
}: SettingsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  // When in full page context (not modal), use native <a> to avoid route interception
  const isModalContext = collapsible === 'none';

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <Sidebar variant={variant} collapsible={collapsible}>
      <SidebarContent>
        {/* Nav Groups from shared config */}
        {settingsNavGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      isActive={pathname === link.href}
                      tooltip={link.label}
                      render={
                        isModalContext ? (
                          <Link href={link.href} replace onClick={handleNavClick}>
                            <link.icon className="size-4" />
                            <span>{link.label}</span>
                          </Link>
                        ) : (
                          <a href={link.href} onClick={handleNavClick}>
                            <link.icon className="size-4" />
                            <span>{link.label}</span>
                          </a>
                        )
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Organizations Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Organizations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {organizations.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="No organizations"
                    className="text-muted-foreground"
                    render={
                      <span>
                        <Building2 className="size-4" />
                        <span>No organizations</span>
                      </span>
                    }
                  />
                </SidebarMenuItem>
              ) : (
                organizations.map((org) => (
                  <SidebarMenuItem key={org.id}>
                    <SidebarMenuButton
                      isActive={pathname === `/${org.slug}/settings`}
                      tooltip={org.name || org.slug}
                      render={
                        isModalContext ? (
                          <Link href={`/${org.slug}/settings`} onClick={handleNavClick}>
                            <Building2 className="size-4" />
                            <span>{org.name || org.slug}</span>
                          </Link>
                        ) : (
                          <a href={`/${org.slug}/settings`} onClick={handleNavClick}>
                            <Building2 className="size-4" />
                            <span>{org.name || org.slug}</span>
                          </a>
                        )
                      }
                    />
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  >
                    <UserAvatar user={user} size="sm" />
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent side="top" align="start" className="w-[--anchor-width]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <Item size="xs">
                      <ItemMedia>
                        <UserAvatar user={user} size="sm" />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{user.name}</ItemTitle>
                        <ItemDescription>{user.email}</ItemDescription>
                      </ItemContent>
                    </Item>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
