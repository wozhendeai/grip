'use client';

import { RouteModal } from '@/components/layout/route-modal';
import { SettingsSidebar } from '../../../settings/_components/settings-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';

type Organization = {
  id: string;
  name: string | null;
  logo: string | null;
  slug: string;
  role: string;
};

type User = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

interface SettingsModalWrapperProps {
  children: React.ReactNode;
  user: User;
  organizations: Organization[];
}

/**
 * Client wrapper for settings modal that checks pathname.
 * Returns null if navigated away from /settings/* to close the modal.
 */
export function SettingsModalWrapper({ children, user, organizations }: SettingsModalWrapperProps) {
  const pathname = usePathname();

  // Close modal if navigated away from /settings/*
  if (!pathname.startsWith('/settings')) {
    return null;
  }

  return (
    <RouteModal title="Settings" useBack>
      <SidebarProvider className="min-h-0 h-[70vh]">
        <SettingsSidebar
          user={user}
          organizations={organizations}
          collapsible="none"
          variant="inset"
        />
        <SidebarInset>
          <div className="flex flex-1 flex-col gap-4 p-4 overflow-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </RouteModal>
  );
}
