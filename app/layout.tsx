import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme/theme-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'BountyLane',
  description: 'Open source bounties on Tempo blockchain',
};

/**
 * Root Layout
 *
 * Design decisions:
 * - ThemeProvider wraps entire app for theme switching
 * - suppressHydrationWarning on html required by next-themes
 * - Font family defined in globals.css (JetBrains Mono)
 * - Dark theme is default (defined in ThemeProvider)
 * - CommandMenu is rendered in Navbar (controlled state)
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
