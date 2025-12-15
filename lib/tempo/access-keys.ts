import { hexToBytes, keccak256, numberToHex, toRlp } from 'viem';
import { encodeWebAuthnSignature, signWithPasskey } from './signing';

/**
 * Client-side Access Key authorization encoding and signing
 *
 * This file handles the KeyAuthorization message that users sign with their passkey
 * to grant BountyLane's backend key permission to sign payouts on their behalf.
 *
 * Flow:
 * 1. Frontend builds KeyAuthorization message with backend keyId and spending limits
 * 2. User signs with WebAuthn passkey
 * 3. Frontend sends signature to backend API
 * 4. Backend stores authorization proof in access_keys table
 * 5. On future payouts, backend includes this authorization in Keychain signature
 */

/**
 * Access Key types (Tempo protocol)
 * - secp256k1: Standard Ethereum key (used by BountyLane backend)
 * - p256: WebAuthn P256 key
 * - webauthn: WebAuthn with full authenticator data
 */
export type AccessKeyType = 0 | 1 | 2; // 0=secp256k1, 1=P256, 2=WebAuthn

/**
 * KeyAuthorization parameters
 *
 * This is the authorization message users sign to grant backend spending permission.
 * Format: rlp([chain_id, key_type, key_id, expiry?, limits?])
 */
export type KeyAuthorizationParams = {
  chainId: number; // 42429 for Tempo testnet, 0 for any chain
  keyType: AccessKeyType; // 0 for secp256k1 backend key
  keyId: `0x${string}`; // Backend wallet address (from Turnkey)
  expiry?: bigint; // Unix timestamp (optional, 0 = never expires)
  limits?: Array<[`0x${string}`, bigint]>; // Array of [token_address, max_amount] pairs
};

/**
 * Encode KeyAuthorization message for signing
 *
 * RLP encoding format (per Tempo spec):
 * rlp([chain_id, key_type, key_id, expiry?, limits?])
 *
 * CRITICAL: Do NOT double-RLP the limits array.
 * Limits should be: [[token1, amount1], [token2, amount2], ...]
 * NOT: rlp([[rlp([token1, amount1]), rlp([token2, amount2])], ...])
 *
 * @param params - KeyAuthorization parameters
 * @returns RLP-encoded message as hex string
 */
export function encodeKeyAuthorization(params: KeyAuthorizationParams): `0x${string}` {
  const fields: `0x${string}`[] = [
    numberToHex(params.chainId),
    numberToHex(params.keyType),
    params.keyId,
  ];

  if (params.expiry !== undefined) {
    fields.push(numberToHex(params.expiry));
  }

  // Limits as array of [token, amount] pairs
  // Each pair is an array, but don't RLP-encode the pairs themselves - viem's toRlp handles nested arrays
  if (params.limits && params.limits.length > 0) {
    const limitsEncoded = params.limits.map(
      ([token, amount]) => [token, numberToHex(amount)] as [`0x${string}`, `0x${string}`]
    );
    fields.push(limitsEncoded as unknown as `0x${string}`);
  }

  return toRlp(fields);
}

/**
 * Sign KeyAuthorization with user's passkey
 *
 * This creates the authorization proof that grants backend key spending permission.
 * User must sign this with their WebAuthn passkey (Root Key).
 *
 * @param params - KeyAuthorization parameters
 * @param credentialId - User's passkey credential ID (base64url encoded)
 * @returns Signature and message hash
 */
export async function signKeyAuthorization(
  params: KeyAuthorizationParams,
  credentialId: string
): Promise<{ signature: `0x${string}`; hash: `0x${string}` }> {
  // Encode KeyAuthorization message
  const encoded = encodeKeyAuthorization(params);

  // Hash the encoded message
  const hash = keccak256(encoded);

  // Convert hash to bytes for WebAuthn challenge
  const challenge = hexToBytes(hash);

  // Sign with user's passkey
  const webAuthnResult = await signWithPasskey(challenge, credentialId);

  // Encode WebAuthn signature for Tempo
  const signature = encodeWebAuthnSignature(webAuthnResult);

  return { signature, hash };
}

/**
 * Build KeyAuthorization parameters for bounty funding
 *
 * Helper to build authorization with reasonable defaults for BountyLane.
 *
 * @param backendKeyId - Backend wallet address (from Turnkey)
 * @param tokenAddress - Token to authorize (e.g., USDC)
 * @param maxAmount - Maximum spending limit in wei (e.g., parseUSDC("10000") for $10k)
 * @param chainId - Chain ID (42429 for testnet)
 * @returns KeyAuthorization parameters ready for signing
 */
export function buildBountyKeyAuthorization(params: {
  backendKeyId: `0x${string}`;
  tokenAddress: `0x${string}`;
  maxAmount: bigint;
  chainId: number;
}): KeyAuthorizationParams {
  return {
    chainId: params.chainId,
    keyType: 0, // secp256k1 (backend uses Turnkey secp256k1 key)
    keyId: params.backendKeyId,
    expiry: BigInt(0), // Never expires (user can revoke manually)
    limits: [[params.tokenAddress, params.maxAmount]],
  };
}
