'use client';

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes';

/**
 * ThemeProvider - Wraps the app with next-themes
 *
 * Design decision: Using next-themes for theme management because:
 * - Handles SSR/hydration correctly (no flash)
 * - Supports system preference detection
 * - Lightweight (~1kb)
 * - Works with Tailwind's class-based dark mode
 *
 * Default theme is 'dark' to maintain GRIP's terminal-noir aesthetic.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
