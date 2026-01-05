import { redirect } from 'next/navigation';
import { SettingsSidebar } from './_components/settings-sidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getSettingsLayoutData } from './_lib/get-settings-layout-data';

export default async function SettingsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const data = await getSettingsLayoutData();
  if (!data) {
    redirect('/login');
  }

  return (
    <SidebarProvider style={{ '--sidebar-top': '4rem' } as React.CSSProperties}>
      <SettingsSidebar user={data.user} organizations={data.organizations} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <span className="font-semibold">Settings</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
      {modal}
    </SidebarProvider>
  );
}
