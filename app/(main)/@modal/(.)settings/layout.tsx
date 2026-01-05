import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { RouteModal } from '@/components/modal/route-modal';
import { SettingsSidebar } from '../../settings/_components/settings-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getSettingsLayoutData } from '../../settings/_lib/get-settings-layout-data';

/**
 * Modal layout for settings (intercepting route)
 *
 * Uses the same SettingsSidebar with collapsible="none" for relative positioning.
 * Mobile users are redirected to the full page settings.
 */
export default async function SettingsModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect mobile users to full page settings
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);

  if (isMobile) {
    redirect('/settings');
  }

  const data = await getSettingsLayoutData();
  if (!data) {
    redirect('/login');
  }

  return (
    <RouteModal title="Settings">
      <SidebarProvider className="min-h-0 h-[70vh]">
        <SettingsSidebar
          user={data.user}
          organizations={data.organizations}
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
