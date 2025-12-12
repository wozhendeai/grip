import type { BetterAuthClientPlugin } from 'better-auth/client';
import type { tempo } from './tempo-plugin';

/**
 * Tempo client plugin for better-auth
 *
 * Provides type inference for the Tempo plugin's schema extensions
 * (tempoAddress field on passkey table)
 */
export const tempoClient = () => {
  return {
    id: 'tempo',
    $InferServerPlugin: {} as ReturnType<typeof tempo>,
  } satisfies BetterAuthClientPlugin;
};
