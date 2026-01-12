import { Building2, Github, Key, LayoutDashboard, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { OrgSettingsContext } from '../_lib/types';

export interface OrgNavItem {
  href: (slug: string) => string;
  label: string;
  icon: LucideIcon;
  description?: string;
  /** Function to check if item should be visible based on context */
  isVisible: (context: OrgSettingsContext) => boolean;
}

export const orgSettingsNavItems: OrgNavItem[] = [
  {
    href: (slug) => `/${slug}/dashboard`,
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Organization overview',
    isVisible: () => true,
  },
  {
    href: (slug) => `/${slug}/settings`,
    label: 'General',
    icon: Building2,
    description: 'Organization details',
    isVisible: () => true,
  },
  {
    href: (slug) => `/${slug}/settings/members`,
    label: 'Members',
    icon: Users,
    description: 'Manage team members',
    isVisible: (ctx) => ctx.canManageMembers,
  },
  {
    href: (slug) => `/${slug}/settings/wallet`,
    label: 'Wallet',
    icon: Wallet,
    description: 'Organization treasury',
    isVisible: (ctx) => ctx.canViewWallet,
  },
  {
    href: (slug) => `/${slug}/settings/access-keys`,
    label: 'Access Keys',
    icon: Key,
    description: 'Delegate spending authority',
    isVisible: (ctx) => ctx.isOwner,
  },
  {
    href: (slug) => `/${slug}/settings/github`,
    label: 'GitHub',
    icon: Github,
    description: 'Sync members from GitHub',
    isVisible: (ctx) => ctx.isOwner && ctx.hasGitHubSync,
  },
];

/**
 * Get visible nav items for a given context
 */
export function getVisibleNavItems(context: OrgSettingsContext): OrgNavItem[] {
  return orgSettingsNavItems.filter((item) => item.isVisible(context));
}
