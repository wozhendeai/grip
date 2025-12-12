import { Navbar } from '@/components/layout/navbar';

/**
 * Main layout for authenticated app pages
 *
 * Provides:
 * - Navbar with auth state
 * - Modal slot for Instagram-style route interception
 */
export default function MainLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>{children}</main>
      {modal}
    </div>
  );
}
