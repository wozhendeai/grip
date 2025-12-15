/**
 * Tempo Keychain Signing (Server-side)
 *
 * Uses Turnkey HSM-backed keys to sign Tempo transactions on behalf of users
 * via Access Key authorization (Keychain signature).
 *
 * Key differences from client-side signing:
 * - Uses secp256k1 backend key (not P256 passkey)
 * - AuthType=0 (secp256k1) instead of AuthType=1 (P256)
 * - Signature format: 0x03 || sender_address (20 bytes) || inner_signature (65 bytes)
 * - Tempo validates on-chain: backend key must be authorized on sender's account
 *
 * Flow:
 * 1. Build transaction parameters (same as client-side)
 * 2. RLP-encode unsigned transaction (with AuthType=0 for secp256k1)
 * 3. Hash unsigned tx to get transaction hash
 * 4. Sign hash with Turnkey API (returns 65-byte ECDSA signature)
 * 5. Wrap signature in Keychain format: 0x03 || sender || sig
 * 6. Encode signed transaction and broadcast
 */

import { turnkey } from '@/lib/turnkey/client';
import { concat, concatHex, keccak256, numberToHex, toRlp } from 'viem';
import { TEMPO_CHAIN_ID } from './constants';
import type { TempoTransactionParams } from './signing';

/**
 * Tempo Transaction Type 0x76 (118 decimal)
 */
const TEMPO_TX_TYPE = 0x76;

/**
 * AuthType for secp256k1 backend key (not P256 passkey)
 * CRITICAL: Use AuthType=0 for Keychain signatures, NOT AuthType=1 (P256)
 */
const AUTH_TYPE_SECP256K1 = 0;

/**
 * Keychain signature prefix
 * 0x03 tells Tempo to validate via Account Keychain Precompile
 */
const KEYCHAIN_SIGNATURE_PREFIX = '0x03';

/**
 * Encode unsigned Tempo transaction for Keychain signing
 *
 * Same as client-side encoding but uses AuthType=0 (secp256k1) for backend key.
 *
 * Format: 0x76 || RLP([chainId, nonce, maxFeePerGas, gas, to, value, data, authType, feeToken, sponsor])
 */
export function encodeUnsignedTransactionForKeychain(
  params: TempoTransactionParams & { from: `0x${string}` }
): `0x${string}` {
  const txFields = [
    numberToHex(TEMPO_CHAIN_ID),
    params.nonce > BigInt(0) ? numberToHex(params.nonce) : '0x',
    params.maxFeePerGas ? numberToHex(params.maxFeePerGas) : numberToHex(BigInt(1_000_000_000)), // 1 gwei default
    params.gas ? numberToHex(params.gas) : numberToHex(BigInt(100_000)), // Default gas
    params.to,
    params.value > BigInt(0) ? numberToHex(params.value) : '0x',
    params.data,
    numberToHex(AUTH_TYPE_SECP256K1), // CRITICAL: AuthType=0 for secp256k1, not 1 (P256)
    params.feeToken ?? '0x',
    params.sponsor ?? '0x',
  ];

  const rlpEncoded = toRlp(txFields as `0x${string}`[]);

  // Prepend type byte 0x76
  return concat([numberToHex(TEMPO_TX_TYPE, { size: 1 }), rlpEncoded]) as `0x${string}`;
}

/**
 * Sign transaction hash using Turnkey API
 *
 * Calls Turnkey to sign the transaction hash with backend secp256k1 key.
 * Returns 65-byte ECDSA primitive signature (r||s||v).
 *
 * @param txHash - Keccak256 hash of unsigned transaction
 * @param network - 'testnet' or 'mainnet' (determines which Turnkey wallet to use)
 * @returns 65-byte ECDSA signature (r||s||v)
 */
export async function signWithTurnkey(
  txHash: `0x${string}`,
  network: 'testnet' | 'mainnet'
): Promise<`0x${string}`> {
  const walletName = `bountylane-backend-${network}`;

  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID not configured');
  }

  // Sign using Turnkey API
  // Turnkey returns 65-byte ECDSA primitive signature (r||s||v)
  const result = await turnkey.signRawPayload({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
    signWith: walletName,
    payload: txHash,
    encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
    hashFunction: 'HASH_FUNCTION_NO_OP', // Already hashed
  });

  // Type assertion: Turnkey SDK types don't include 'signature' property in response
  // but the API actually returns it. This is a known gap in @turnkey/sdk-server types.
  // Runtime structure: { r: string, s: string, v: string, signature: string, ... }
  // The 'signature' field is the concatenated r||s||v in hex format (65 bytes)
  type SignRawPayloadResult = typeof result & { signature: string };
  return (result as SignRawPayloadResult).signature as `0x${string}`;
}

/**
 * Encode Keychain signature
 *
 * Keychain signature format (per Tempo spec):
 * 0x03 || sender_address (20 bytes) || inner_signature (65 bytes)
 *
 * Total: 86 bytes (1 + 20 + 65)
 *
 * This tells Tempo:
 * "Check if backend key is authorized on sender's account via Keychain Precompile"
 *
 * @param senderAddress - Funder's address (account we're acting on behalf of)
 * @param innerSignature - 65-byte ECDSA signature from Turnkey
 * @returns Keychain signature (86 bytes)
 */
export function encodeKeychainSignature(
  senderAddress: `0x${string}`,
  innerSignature: `0x${string}`
): `0x${string}` {
  // Keychain signature: 0x03 || sender (20 bytes) || signature (65 bytes)
  return concatHex([KEYCHAIN_SIGNATURE_PREFIX, senderAddress, innerSignature]);
}

/**
 * Encode signed Tempo transaction with Keychain signature
 *
 * Format: 0x76 || RLP([chainId, nonce, maxFeePerGas, gas, to, value, data, authType, feeToken, sponsor, keychainSignature])
 */
export function encodeSignedTransactionWithKeychain(
  params: TempoTransactionParams & { from: `0x${string}` },
  keychainSignature: `0x${string}`
): `0x${string}` {
  const txFields = [
    numberToHex(TEMPO_CHAIN_ID),
    params.nonce > BigInt(0) ? numberToHex(params.nonce) : '0x',
    params.maxFeePerGas ? numberToHex(params.maxFeePerGas) : numberToHex(BigInt(1_000_000_000)),
    params.gas ? numberToHex(params.gas) : numberToHex(BigInt(100_000)),
    params.to,
    params.value > BigInt(0) ? numberToHex(params.value) : '0x',
    params.data,
    numberToHex(AUTH_TYPE_SECP256K1), // AuthType=0 for secp256k1
    params.feeToken ?? '0x',
    params.sponsor ?? '0x',
    keychainSignature,
  ];

  const rlpEncoded = toRlp(txFields as `0x${string}`[]);

  return concat([numberToHex(TEMPO_TX_TYPE, { size: 1 }), rlpEncoded]) as `0x${string}`;
}

/**
 * Sign transaction with Access Key (Keychain signature via Turnkey)
 *
 * Complete flow for signing a Tempo transaction using backend Access Key:
 * 1. Encode unsigned transaction with AuthType=0
 * 2. Hash unsigned transaction
 * 3. Sign hash with Turnkey
 * 4. Wrap signature in Keychain format (0x03 || sender || sig)
 * 5. Encode signed transaction
 *
 * @param params - Transaction parameters
 * @param funderAddress - Funder's address (sender account)
 * @param network - 'testnet' or 'mainnet'
 * @returns Signed transaction and hash
 */
export async function signTransactionWithAccessKey(params: {
  tx: TempoTransactionParams;
  funderAddress: `0x${string}`;
  network: 'testnet' | 'mainnet';
}): Promise<{ rawTransaction: `0x${string}`; hash: `0x${string}` }> {
  // Create unsigned transaction (with funder as sender)
  const unsignedTx = encodeUnsignedTransactionForKeychain({
    ...params.tx,
    from: params.funderAddress,
  });

  // Hash unsigned transaction
  const txHash = keccak256(unsignedTx);

  // Sign with Turnkey (returns 65-byte ECDSA signature)
  const innerSignature = await signWithTurnkey(txHash, params.network);

  // Wrap in Keychain signature format
  const keychainSignature = encodeKeychainSignature(params.funderAddress, innerSignature);

  // Encode signed transaction
  const signedTx = encodeSignedTransactionWithKeychain(
    { ...params.tx, from: params.funderAddress },
    keychainSignature
  );

  return {
    rawTransaction: signedTx,
    hash: keccak256(signedTx),
  };
}

/**
 * Broadcast signed transaction to Tempo RPC
 *
 * @param signedTx - Signed transaction hex string
 * @returns Transaction hash
 */
export async function broadcastTransaction(signedTx: `0x${string}`): Promise<`0x${string}`> {
  const TEMPO_RPC_URL = process.env.TEMPO_RPC_URL ?? 'https://rpc.testnet.tempo.xyz';

  const response = await fetch(TEMPO_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendRawTransaction',
      params: [signedTx],
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result as `0x${string}`;
}
