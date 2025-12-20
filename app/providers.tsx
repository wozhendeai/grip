'use client';

/**
 * Global Providers Wrapper
 *
 * This component wraps the entire application with necessary providers:
 * - WagmiProvider: Provides Wagmi context for wallet/account management
 * - QueryClientProvider: Required by Wagmi for React Query integration
 *
 * Architecture Note:
 * We're adding Wagmi/Tempo SDK providers alongside existing better-auth.
 * This hybrid approach allows us to:
 * - Keep better-auth for user authentication
 * - Use SDK's webAuthn connector for transaction signing
 * - Share the same passkey credentials between both systems
 */

import { config } from '@/lib/wagmi-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

// Create a single QueryClient instance for the app
// Using default configuration which handles:
// - Automatic refetching on window focus
// - Error retry logic
// - Stale time management
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduce refetch frequency for better UX
      // Wallet/account data doesn't change frequently
      refetchOnWindowFocus: false,
      // Retry failed requests once before showing error
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers Component
 *
 * Wraps children with Wagmi and React Query providers.
 * Must be used in app/layout.tsx to enable SDK features across the app.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
