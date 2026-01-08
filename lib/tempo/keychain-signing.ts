/**
 * Tempo Keychain Signing (Server-side) - SDK Version
 *
 * Uses Turnkey HSM-backed keys to sign Tempo transactions on behalf of users
 * via Access Key authorization (Keychain signature).
 *
 * Uses Tempo SDK's Transaction and SignatureEnvelope utilities.
 *
 * Flow:
 * 1. Build transaction with calls array
 * 2. Serialize unsigned tx with SDK (handles Type 0x76 RLP)
 * 3. Hash serialized transaction
 * 4. Sign hash with Turnkey API
 * 5. Create SignatureEnvelope.Keychain with inner secp256k1 sig
 * 6. Serialize signed tx with SDK
 */
'use server';
import { turnkey } from '@/lib/turnkey';
import { SignatureEnvelope } from 'ox/tempo';
import { Transaction } from 'viem/tempo';
import { keccak256 } from 'viem';
import { tempoClient } from './client';

/**
 * Tempo transaction parameters
 */
export type TempoTransactionParams = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  nonce: bigint;
  maxFeePerGas?: bigint;
  gas?: bigint;
  feeToken?: `0x${string}`;
};

/**
 * Sign transaction hash using Turnkey API
 *
 * @returns r, s, v components of ECDSA signature
 */
async function signWithTurnkey(
  txHash: `0x${string}`,
  network: 'testnet' | 'mainnet'
): Promise<{ r: bigint; s: bigint; yParity: 0 | 1 }> {
  const walletName = `grip-backend-${network}`;

  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID not configured');
  }

  const result = await turnkey.signRawPayload({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
    signWith: walletName,
    payload: txHash.slice(2), // Remove 0x prefix
    encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
    hashFunction: 'HASH_FUNCTION_NO_OP', // Already hashed
  });

  // Extract signature components from Turnkey response
  const signResult = result.activity?.result?.signRawPayloadResult;
  if (!signResult) {
    throw new Error('No signature result from Turnkey');
  }

  return {
    r: BigInt(`0x${signResult.r}`),
    s: BigInt(`0x${signResult.s}`),
    yParity: signResult.v === '00' ? 0 : 1,
  };
}

/**
 * Sign transaction with Access Key (Keychain signature via Turnkey)
 *
 * @param params - Transaction parameters
 * @param funderAddress - Funder's address (the user whose Access Key authorizes this)
 * @param network - 'testnet' or 'mainnet'
 * @returns Signed transaction and hash
 */
export async function signTransactionWithAccessKey(params: {
  tx: TempoTransactionParams;
  funderAddress: `0x${string}`;
  network: 'testnet' | 'mainnet';
}): Promise<{ rawTransaction: `0x${string}`; hash: `0x${string}` }> {
  // Get fee token: explicit param > user preference > protocol fallback
  // Protocol fallback chain: Account → Contract → pathUSD
  let feeToken = params.tx.feeToken;
  if (!feeToken) {
    // Fetch user's fee token preference from on-chain
    const userFeeToken = await tempoClient.fee.getUserToken({
      account: params.funderAddress,
    });
    feeToken = userFeeToken?.address; // undefined lets protocol handle fallback
  }

  // Build transaction object for SDK (Tempo uses calls array)
  const tx = {
    type: 'tempo' as const,
    chainId: tempoClient.chain.id,
    nonce: Number(params.tx.nonce),
    maxFeePerGas: params.tx.maxFeePerGas ?? 1_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    gas: params.tx.gas ?? 100_000n,
    calls: [
      {
        to: params.tx.to,
        value: params.tx.value,
        data: params.tx.data,
      },
    ],
    feeToken,
  };

  // 1. Serialize unsigned transaction (SDK handles Type 0x76 RLP)
  const unsignedTx = await Transaction.serialize(tx);

  // 2. Hash unsigned transaction
  const txHash = keccak256(unsignedTx);

  // 3. Sign with Turnkey HSM
  const { r, s, yParity } = await signWithTurnkey(txHash, params.network);

  // 4. Create inner secp256k1 signature envelope
  const innerSignature = SignatureEnvelope.from({
    signature: { r, s, yParity },
    type: 'secp256k1',
  });

  // 5. Wrap in Keychain envelope (0x03 || userAddress || innerSig)
  const keychainSignature = SignatureEnvelope.from({
    userAddress: params.funderAddress,
    inner: innerSignature,
    type: 'keychain',
  });

  // 6. Serialize signed transaction with keychain signature
  const signedTx = await Transaction.serialize(tx, keychainSignature);

  return {
    rawTransaction: signedTx,
    hash: keccak256(signedTx),
  };
}

/**
 * Broadcast signed transaction to Tempo RPC
 */
export async function broadcastTransaction(signedTx: `0x${string}`): Promise<`0x${string}`> {
  const rpcUrl = process.env.TEMPO_RPC_URL ?? tempoClient.chain.rpcUrls.default.http[0];

  const response = await fetch(rpcUrl, {
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
