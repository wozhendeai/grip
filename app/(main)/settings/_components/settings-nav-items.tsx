import { Bell, Building2, Key, TrendingUp, User, Wallet, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const settingsNavGroups: NavGroup[] = [
  {
    title: 'Account',
    items: [
      { href: '/settings', label: 'Profile', icon: User },
      { href: '/settings/wallet', label: 'Wallet', icon: Wallet },
      { href: '/settings/activity', label: 'Activity', icon: TrendingUp },
      { href: '/settings/access-keys', label: 'Access Keys', icon: Key },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

/**
 * Icon used for organization nav items
 */
export const organizationIcon = Building2;

/**
 * Flat list of all nav items (excluding dynamic organization items)
 */
export const flatNavItems = settingsNavGroups.flatMap((g) => g.items);
