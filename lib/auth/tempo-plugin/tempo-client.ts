import type { BetterAuthClientPlugin } from 'better-auth/client';
import type { tempo } from './tempo-plugin';
import type {
  AccessKeyStatus,
  CreateAccessKeyRequest,
  CreateAccessKeyResponse,
  GetAccessKeyResponse,
  ListAccessKeysResponse,
  ListKeysResponse,
  ListPasskeysResponse,
  LoadKeyResponse,
  RevokeAccessKeyRequest,
  RevokeAccessKeyResponse,
  SaveKeyRequest,
  SaveKeyResponse,
} from './types';

/**
 * Tempo client plugin for better-auth
 *
 * Provides client-side API for Tempo plugin endpoints:
 * - Access Keys: Create, list, get, revoke
 * - Passkeys: List user's passkeys with Tempo addresses
 * - KeyManager: Tempo SDK integration for signing
 *
 * Usage:
 * ```typescript
 * import { authClient } from '@/lib/auth/auth-client';
 *
 * // Access Keys
 * const { accessKeys } = await authClient.api.tempo.listAccessKeys();
 * const { accessKey } = await authClient.api.tempo.createAccessKey({ ... });
 * const { accessKey } = await authClient.api.tempo.getAccessKey('id');
 * await authClient.api.tempo.revokeAccessKey('id', { reason: '...' });
 *
 * // Passkeys
 * const { passkeys } = await authClient.api.tempo.listPasskeys();
 *
 * // KeyManager (Tempo SDK)
 * const { keys } = await authClient.api.tempo.listKeys();
 * const key = await authClient.api.tempo.loadKey('credentialId');
 * ```
 */
export const tempoClient = () => {
  return {
    id: 'tempo',
    $InferServerPlugin: {} as ReturnType<typeof tempo>,

    // Client-side API methods
    getActions: ($fetch) => ({
      // Access Key management
      listAccessKeys: async (params?: { status?: AccessKeyStatus }) => {
        const searchParams = new URLSearchParams();
        if (params?.status) {
          searchParams.set('status', params.status);
        }

        const url = `/tempo/access-keys${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        return $fetch<ListAccessKeysResponse>(url, {
          method: 'GET',
        });
      },

      createAccessKey: async (params: CreateAccessKeyRequest) => {
        return $fetch<CreateAccessKeyResponse>('/tempo/access-keys', {
          method: 'POST',
          body: params,
        });
      },

      getAccessKey: async (id: string) => {
        return $fetch<GetAccessKeyResponse>(`/tempo/access-keys/${id}`, {
          method: 'GET',
        });
      },

      revokeAccessKey: async (id: string, params?: RevokeAccessKeyRequest) => {
        return $fetch<RevokeAccessKeyResponse>(`/tempo/access-keys/${id}`, {
          method: 'DELETE',
          body: params,
        });
      },

      // Passkey listing
      listPasskeys: async () => {
        return $fetch<ListPasskeysResponse>('/tempo/passkeys', {
          method: 'GET',
        });
      },

      // KeyManager (Tempo SDK integration)
      listKeys: async () => {
        return $fetch<ListKeysResponse>('/tempo/keymanager', {
          method: 'GET',
        });
      },

      loadKey: async (credentialId: string) => {
        return $fetch<LoadKeyResponse>(`/tempo/keymanager/${credentialId}`, {
          method: 'GET',
        });
      },

      saveKey: async (credentialId: string, params: SaveKeyRequest) => {
        return $fetch<SaveKeyResponse>(`/tempo/keymanager/${credentialId}`, {
          method: 'POST',
          body: params,
        });
      },
    }),
  } satisfies BetterAuthClientPlugin;
};
