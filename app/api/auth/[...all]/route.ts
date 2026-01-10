/**
 * better-auth catch-all handler for authentication endpoints.
 *
 * Handles:
 * - GitHub OAuth (login, callback)
 * - Session management (get, sign-out)
 * - Organization APIs
 * - Tempo plugin endpoints:
 *   - /tempo/passkey/* - Passkey registration & authentication (ES256 only)
 *   - /tempo/wallets/* - Wallet management
 *   - /tempo/access-keys/* - Access key management
 *   - /tempo/keymanager/* - SDK integration
 */
import { auth } from '@/lib/auth/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST, DELETE } = toNextJsHandler(auth);
