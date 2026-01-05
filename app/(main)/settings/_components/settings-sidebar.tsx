'use client';

import { UserAvatar } from '@/components/user/user-avatar';
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
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Building2, LogOut } from 'lucide-react';
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
                        <Link href={link.href} onClick={handleNavClick}>
                          <link.icon className="size-4" />
                          <span>{link.label}</span>
                        </Link>
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
                      isActive={pathname === `/settings/organizations/${org.id}`}
                      tooltip={org.name || org.slug}
                      render={
                        <Link href={`/settings/organizations/${org.id}`} onClick={handleNavClick}>
                          <Building2 className="size-4" />
                          <span>{org.name || org.slug}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarSeparator className="mx-0" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={user.name || 'User'}
              className="h-auto py-2"
              render={
                <div className="flex items-center gap-2 w-full">
                  <UserAvatar user={user} size="sm" />
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              }
            />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={handleSignOut}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
