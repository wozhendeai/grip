/**
 * Tempo Transaction Signing Utilities (Client-side)
 *
 * Uses WebAuthn passkeys to sign Tempo transactions.
 *
 * Key insight: Tempo supports P256/secp256r1 natively (AuthType=1),
 * which is the same curve used by WebAuthn ES256. This means we can
 * sign transactions directly with passkeys without conversion.
 *
 * Flow:
 * 1. Build transaction parameters (to, data, value, etc.)
 * 2. RLP-encode transaction to get unsigned tx bytes
 * 3. Hash the unsigned tx to create the challenge
 * 4. Sign challenge with WebAuthn using treasury passkey
 * 5. Append signature to create signed transaction
 * 6. Broadcast to Tempo RPC
 */

import { concat, hexToBytes, keccak256, numberToHex, toHex, toRlp } from 'viem';
import { TEMPO_CHAIN_ID, TEMPO_RPC_URL } from './constants';

/**
 * Tempo Transaction Type 0x76 (118 decimal)
 * Native transaction type with P256/Passkey support
 */
const TEMPO_TX_TYPE = 0x76;

/**
 * AuthType for P256/Passkey signatures
 * AuthType=1 means the signature uses P256 curve (WebAuthn compatible)
 */
const AUTH_TYPE_P256 = 1;

export type TempoTransactionParams = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  nonce: bigint;
  maxFeePerGas?: bigint;
  gas?: bigint;
  feeToken?: `0x${string}`;
  sponsor?: `0x${string}`;
};

export type SignedTransaction = {
  rawTransaction: `0x${string}`;
  hash: `0x${string}`;
};

export type WebAuthnSignatureResult = {
  authenticatorData: ArrayBuffer;
  clientDataJSON: ArrayBuffer;
  signature: ArrayBuffer;
};

/**
 * Get the current nonce for an address from Tempo RPC
 */
export async function getNonce(address: `0x${string}`): Promise<bigint> {
  const response = await fetch(TEMPO_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getTransactionCount',
      params: [address, 'pending'],
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return BigInt(data.result);
}

/**
 * Get current gas price from Tempo RPC
 */
export async function getGasPrice(): Promise<bigint> {
  const response = await fetch(TEMPO_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_gasPrice',
      params: [],
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return BigInt(data.result);
}

/**
 * Encode an unsigned Tempo transaction for signing
 *
 * Tempo Transaction (Type 0x76) format:
 * [chainId, nonce, maxFeePerGas, gas, to, value, data, authType, feeToken, sponsor]
 */
export function encodeUnsignedTransaction(
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
    numberToHex(AUTH_TYPE_P256),
    params.feeToken ?? '0x', // Empty means default fee token
    params.sponsor ?? '0x', // Empty means no sponsor
  ];

  const rlpEncoded = toRlp(txFields as `0x${string}`[]);

  // Prepend type byte 0x76
  return concat([numberToHex(TEMPO_TX_TYPE, { size: 1 }), rlpEncoded]) as `0x${string}`;
}

/**
 * Create the challenge (message to sign) for a Tempo transaction
 *
 * The challenge is keccak256(unsigned_tx_bytes)
 */
export function createTransactionChallenge(
  params: TempoTransactionParams & { from: `0x${string}` }
): Uint8Array {
  const unsignedTx = encodeUnsignedTransaction(params);
  const txHash = keccak256(unsignedTx);
  return hexToBytes(txHash);
}

/**
 * Sign a Tempo transaction using WebAuthn passkey
 *
 * This calls navigator.credentials.get() to trigger the passkey signing UI.
 * The credentialId should be the base64url-encoded credential ID from the passkey.
 */
export async function signWithPasskey(
  challenge: Uint8Array,
  credentialId: string
): Promise<WebAuthnSignatureResult> {
  if (typeof window === 'undefined' || !navigator.credentials) {
    throw new Error('WebAuthn is only available in browser environments');
  }

  // Decode base64url credential ID to ArrayBuffer for WebAuthn
  const credentialIdBytes = base64urlToBytes(credentialId);
  const credentialIdBuffer = credentialIdBytes.buffer.slice(
    credentialIdBytes.byteOffset,
    credentialIdBytes.byteOffset + credentialIdBytes.byteLength
  ) as ArrayBuffer;

  // Convert challenge to ArrayBuffer
  const challengeBuffer = challenge.buffer.slice(
    challenge.byteOffset,
    challenge.byteOffset + challenge.byteLength
  ) as ArrayBuffer;

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: challengeBuffer,
      allowCredentials: [
        {
          type: 'public-key',
          id: credentialIdBuffer,
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential;

  if (!assertion) {
    throw new Error('Failed to get credential assertion');
  }

  const assertionResponse = assertion.response as AuthenticatorAssertionResponse;

  return {
    authenticatorData: assertionResponse.authenticatorData,
    clientDataJSON: assertionResponse.clientDataJSON,
    signature: assertionResponse.signature,
  };
}

/**
 * Encode a WebAuthn signature for Tempo
 *
 * Tempo expects P256 signatures in a specific format that includes
 * the authenticator data and client data JSON for verification.
 *
 * Format: RLP([authenticatorData, clientDataJSON, r, s])
 */
export function encodeWebAuthnSignature(result: WebAuthnSignatureResult): `0x${string}` {
  // Parse the DER-encoded signature to extract r and s
  const { r, s } = parseDerSignature(new Uint8Array(result.signature));

  const signatureFields = [
    toHex(new Uint8Array(result.authenticatorData)),
    toHex(new Uint8Array(result.clientDataJSON)),
    toHex(r),
    toHex(s),
  ];

  return toRlp(signatureFields as `0x${string}`[]);
}

/**
 * Encode a signed Tempo transaction
 *
 * Format: 0x76 || RLP([chainId, nonce, maxFeePerGas, gas, to, value, data, authType, feeToken, sponsor, signatureData])
 */
export function encodeSignedTransaction(
  params: TempoTransactionParams & { from: `0x${string}` },
  signatureData: `0x${string}`
): `0x${string}` {
  const txFields = [
    numberToHex(TEMPO_CHAIN_ID),
    params.nonce > BigInt(0) ? numberToHex(params.nonce) : '0x',
    params.maxFeePerGas ? numberToHex(params.maxFeePerGas) : numberToHex(BigInt(1_000_000_000)),
    params.gas ? numberToHex(params.gas) : numberToHex(BigInt(100_000)),
    params.to,
    params.value > BigInt(0) ? numberToHex(params.value) : '0x',
    params.data,
    numberToHex(AUTH_TYPE_P256),
    params.feeToken ?? '0x',
    params.sponsor ?? '0x',
    signatureData,
  ];

  const rlpEncoded = toRlp(txFields as `0x${string}`[]);

  return concat([numberToHex(TEMPO_TX_TYPE, { size: 1 }), rlpEncoded]) as `0x${string}`;
}

/**
 * Sign a Tempo transaction with a passkey and return the signed transaction
 */
export async function signTempoTransaction(params: {
  tx: TempoTransactionParams;
  from: `0x${string}`;
  credentialId: string;
}): Promise<SignedTransaction> {
  const txWithFrom = { ...params.tx, from: params.from };

  // Create challenge from unsigned transaction
  const challenge = createTransactionChallenge(txWithFrom);

  // Sign with passkey
  const signatureResult = await signWithPasskey(challenge, params.credentialId);

  // Encode signature for Tempo
  const signatureData = encodeWebAuthnSignature(signatureResult);

  // Create signed transaction
  const rawTransaction = encodeSignedTransaction(txWithFrom, signatureData);

  // Calculate transaction hash
  const hash = keccak256(rawTransaction);

  return { rawTransaction, hash };
}

/**
 * Broadcast a signed transaction to Tempo RPC
 */
export async function broadcastTransaction(
  signedTx: SignedTransaction
): Promise<{ txHash: string }> {
  const response = await fetch(TEMPO_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendRawTransaction',
      params: [signedTx.rawTransaction],
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`Broadcast failed: ${data.error.message}`);
  }

  return { txHash: data.result };
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForConfirmation(
  txHash: string,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<{ blockNumber: number; status: 'success' | 'reverted' }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const response = await fetch(TEMPO_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    if (data.result) {
      const receipt = data.result;
      return {
        blockNumber: Number.parseInt(receipt.blockNumber, 16),
        status: receipt.status === '0x1' ? 'success' : 'reverted',
      };
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Transaction confirmation timeout');
}

// Helper functions

/**
 * Convert base64url string to Uint8Array
 */
function base64urlToBytes(base64url: string): Uint8Array {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with = if needed
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse DER-encoded ECDSA signature to extract r and s values
 *
 * DER format: 0x30 [total-length] 0x02 [r-length] [r...] 0x02 [s-length] [s...]
 */
function parseDerSignature(derSignature: Uint8Array): { r: Uint8Array; s: Uint8Array } {
  let offset = 0;

  // Check sequence tag (0x30)
  if (derSignature[offset++] !== 0x30) {
    throw new Error('Invalid DER signature: expected sequence tag');
  }

  // Skip sequence length
  let seqLen = derSignature[offset++];
  if (seqLen & 0x80) {
    // Extended length
    const lenBytes = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < lenBytes; i++) {
      seqLen = (seqLen << 8) | derSignature[offset++];
    }
  }

  // Parse r
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: expected integer tag for r');
  }
  let rLen = derSignature[offset++];
  // Skip leading zero if present (for positive number encoding)
  if (derSignature[offset] === 0x00) {
    offset++;
    rLen--;
  }
  const r = derSignature.slice(offset, offset + rLen);
  offset += rLen;

  // Parse s
  if (derSignature[offset++] !== 0x02) {
    throw new Error('Invalid DER signature: expected integer tag for s');
  }
  let sLen = derSignature[offset++];
  // Skip leading zero if present
  if (derSignature[offset] === 0x00) {
    offset++;
    sLen--;
  }
  const s = derSignature.slice(offset, offset + sLen);

  // Pad r and s to 32 bytes each
  const rPadded = padTo32Bytes(r);
  const sPadded = padTo32Bytes(s);

  return { r: rPadded, s: sPadded };
}

/**
 * Pad a byte array to 32 bytes (left-pad with zeros)
 */
function padTo32Bytes(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 32) {
    return bytes.slice(bytes.length - 32);
  }
  const padded = new Uint8Array(32);
  padded.set(bytes, 32 - bytes.length);
  return padded;
}
