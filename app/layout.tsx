import { ThemeProvider } from '@/components/theme/theme-provider';
import type { Metadata } from 'next';
import { Noto_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'BountyLane',
  description: 'Open source bounties on Tempo blockchain',
};

/**
 * Root Layout
 *
 * Design decisions:
 * - Providers wraps everything for Wagmi + React Query (SDK requirement)
 * - ThemeProvider wraps entire app for theme switching
 * - suppressHydrationWarning on html required by next-themes
 * - Font: Noto Sans via next/font/google (Mira preset)
 * - Dark theme is default (defined in ThemeProvider)
 * - CommandMenu is rendered in Navbar (controlled state)
 *
 * Provider hierarchy:
 * 1. Providers (Wagmi + React Query) - Enables SDK features
 * 2. ThemeProvider - Theme switching
 * 3. Children - App content
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={notoSans.variable}>
      <body className="antialiased">
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
