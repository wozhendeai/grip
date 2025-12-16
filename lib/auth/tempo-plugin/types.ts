/**
 * Tempo Better Auth Plugin Types
 *
 * Type definitions for plugin configuration, endpoints, and client API.
 */

import type { BetterAuthPlugin } from 'better-auth';

// ============================================================================
// Plugin Configuration
// ============================================================================

/**
 * Backend wallet provider type
 */
export type BackendWalletProvider = 'turnkey' | 'custom';

/**
 * Tempo transaction parameters
 */
export interface TempoTransactionParams {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  nonce: bigint;
}

/**
 * Backend wallet configuration
 * Provides backend signing capabilities for Access Key authorization
 */
export interface BackendWalletConfig {
  /** Provider type (Turnkey HSM, custom implementation, etc.) */
  provider: BackendWalletProvider;

  /**
   * Get backend wallet address for signing
   * @param network - Optional network identifier (app-specific)
   * @returns Backend wallet address
   */
  getAddress: (network?: string) => Promise<`0x${string}`>;

  /**
   * Sign transaction with backend wallet
   * Used when Access Key authorization is valid
   */
  signTransaction: (params: {
    tx: TempoTransactionParams;
    funderAddress: `0x${string}`;
    network?: string;
  }) => Promise<{
    rawTransaction: `0x${string}`;
    hash: `0x${string}`;
  }>;
}

/**
 * Tempo plugin configuration
 */
export interface TempoPluginConfig {
  /**
   * Backend wallet provider for Access Key signing
   * Required for Access Key functionality
   */
  backendWallet: BackendWalletConfig;

  /**
   * Enable multi-network support
   * Adds 'network' column to accessKeys table
   * @default false
   */
  enableNetworkField?: boolean;

  /**
   * Allowed chain IDs for Access Keys
   * Validates chainId during Access Key creation
   * @default undefined (any chain)
   */
  allowedChainIds?: number[];

  /**
   * Default settings for Access Keys
   */
  accessKeyDefaults?: {
    /** Default expiry in seconds */
    expiry?: number;
    /** Default label */
    label?: string;
  };
}

// ============================================================================
// Access Key Types
// ============================================================================

/**
 * Access Key status
 */
export type AccessKeyStatus = 'active' | 'revoked' | 'expired';

/**
 * Access Key type (Tempo protocol)
 */
export type AccessKeyType = 'secp256k1' | 'p256' | 'webauthn';

/**
 * Spending limit structure for a single token
 */
export interface SpendingLimit {
  initial: string; // Wei amount as string
  remaining: string; // Wei amount as string
}

/**
 * Access Key record from database
 */
export interface AccessKey {
  id: string;
  network?: string;
  userId: string;
  backendWalletAddress: string;
  keyType: AccessKeyType;
  chainId: number;
  expiry: bigint | null;
  limits: Record<string, SpendingLimit>;
  authorizationSignature: string;
  authorizationHash: string;
  status: AccessKeyStatus;
  revokedAt: string | null;
  revokedReason: string | null;
  label: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Endpoint Request/Response Types
// ============================================================================

/**
 * POST /tempo/access-keys - Create Access Key
 */
export interface CreateAccessKeyRequest {
  keyId: string; // Backend wallet address
  chainId: number; // 42429 for Tempo testnet
  keyType: 0 | 1 | 2; // 0=secp256k1, 1=P256, 2=WebAuthn
  expiry?: number; // Unix timestamp (optional)
  limits: Record<string, string>; // { "0xToken": "1000000000" }
  signature: string; // WebAuthn signature
  label?: string; // Optional user-friendly label
  network?: string; // Optional network (if enableNetworkField=true)
}

export interface CreateAccessKeyResponse {
  accessKey: AccessKey;
}

/**
 * GET /tempo/access-keys - List Access Keys
 */
export interface ListAccessKeysRequest {
  status?: AccessKeyStatus; // Filter by status
}

export interface ListAccessKeysResponse {
  accessKeys: AccessKey[];
}

/**
 * GET /tempo/access-keys/:id - Get Access Key
 */
export interface GetAccessKeyResponse {
  accessKey: AccessKey;
}

/**
 * DELETE /tempo/access-keys/:id - Revoke Access Key
 */
export interface RevokeAccessKeyRequest {
  reason?: string; // Optional revocation reason
}

export interface RevokeAccessKeyResponse {
  accessKey: AccessKey;
}

/**
 * Passkey record with Tempo address
 */
export interface PasskeyWithAddress {
  id: string;
  userId: string;
  name: string | null;
  credentialID: string;
  tempoAddress: string | null;
  createdAt: string; // ISO 8601 string after JSON serialization
}

/**
 * GET /tempo/passkeys - List Passkeys
 */
export interface ListPasskeysResponse {
  passkeys: PasskeyWithAddress[];
}

/**
 * KeyManager key format (Tempo SDK)
 */
export interface KeyManagerKey {
  credentialId: string;
  publicKey: string; // hex format
  address: string; // Tempo address
}

/**
 * GET /tempo/keymanager - List Keys
 */
export interface ListKeysResponse {
  keys: KeyManagerKey[];
}

/**
 * GET /tempo/keymanager?credentialId=... - Load Key
 */
export interface LoadKeyResponse {
  credentialId: string;
  publicKey: string; // hex format
  address: string; // Tempo address
}

/**
 * POST /tempo/keymanager - Save Key
 */
export interface SaveKeyRequest {
  credentialId: string;
  publicKey: string; // hex format
  address: string; // Tempo address
}

export interface SaveKeyResponse {
  success: boolean;
}

// ============================================================================
// Client API Types
// ============================================================================

/**
 * Client-side methods exposed by the plugin
 * Used via: authClient.api.tempo.*
 */
export interface TempoClientAPI {
  // Access Keys
  listAccessKeys: (params?: { status?: AccessKeyStatus }) => Promise<ListAccessKeysResponse>;
  createAccessKey: (params: CreateAccessKeyRequest) => Promise<CreateAccessKeyResponse>;
  getAccessKey: (id: string) => Promise<GetAccessKeyResponse>;
  revokeAccessKey: (
    id: string,
    params?: RevokeAccessKeyRequest
  ) => Promise<RevokeAccessKeyResponse>;

  // Passkeys
  listPasskeys: () => Promise<ListPasskeysResponse>;

  // KeyManager
  listKeys: () => Promise<ListKeysResponse>;
  loadKey: (credentialId: string) => Promise<LoadKeyResponse>;
  saveKey: (params: SaveKeyRequest) => Promise<SaveKeyResponse>;
}

// ============================================================================
// Plugin Type Export
// ============================================================================

/**
 * Tempo plugin factory type
 */
export type TempoPlugin = (config: TempoPluginConfig) => BetterAuthPlugin;
