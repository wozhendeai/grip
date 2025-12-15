import { TEMPO_CHAIN_ID } from '@/lib/tempo/constants';
import { turnkey } from './client';

/**
 * Turnkey Custodial Wallets for Contributors Without Accounts
 *
 * When a contributor completes a bounty but doesn't have a BountyLane account,
 * we create a Turnkey-managed P256 wallet and send payment immediately.
 * The contributor can later claim funds by signing up and creating a passkey wallet.
 *
 * Flow:
 * 1. Funder approves bounty → we detect contributor has no wallet
 * 2. Create Turnkey wallet for contributor (identified by GitHub user ID)
 * 3. Send payment to custodial wallet (verifiable on-chain)
 * 4. Contributor signs up → transfer funds from custodial wallet to passkey wallet
 *    using Tempo fee sponsorship (backend pays gas)
 *
 * Why Turnkey:
 * - Production-grade custody (extends existing Access Key pattern)
 * - P256 compatible (works with Tempo's passkey infrastructure)
 * - No private keys stored on BountyLane servers
 * - Identical signing pattern to Access Keys
 */

/**
 * Create a Turnkey P256 wallet for a GitHub user
 *
 * Creates a new wallet with a unique name based on GitHub user ID and timestamp.
 * Uses standard Ethereum derivation path for EVM compatibility.
 *
 * @param params.githubUserId - GitHub user ID for unique wallet naming
 * @param params.githubUsername - GitHub username for reference
 * @returns Wallet ID, account ID, and Ethereum address
 */
export async function createCustodialWallet(params: {
  githubUserId: number;
  githubUsername: string;
}): Promise<{
  walletId: string;
  accountId: string;
  address: string;
}> {
  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID not configured');
  }

  // Create wallet with unique name
  // Pattern: custodial-gh-{userId}-{timestamp}
  // Example: custodial-gh-12345678-1702934400000
  const walletName = `custodial-gh-${params.githubUserId}-${Date.now()}`;

  try {
    const wallet = await turnkey.createWallet({
      organizationId: process.env.TURNKEY_ORGANIZATION_ID,
      walletName,
      accounts: [
        {
          curve: 'CURVE_SECP256K1', // EVM-compatible curve
          pathFormat: 'PATH_FORMAT_BIP32',
          path: "m/44'/60'/0'/0/0", // Standard Ethereum path
          addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
        },
      ],
    });

    // Type assertion: Turnkey SDK types don't include 'addresses' property
    // but the API actually returns it. This is a known gap in @turnkey/sdk-server types.
    // Runtime structure: { walletId, accounts: [{ accountId, address, ... }], ... }
    type WalletResponse = {
      walletId: string;
      accounts: Array<{
        accountId: string;
        address: string;
      }>;
    };

    const typedWallet = wallet as unknown as WalletResponse;

    if (!typedWallet.accounts?.[0]) {
      throw new Error('Turnkey wallet created but no account returned');
    }

    return {
      walletId: typedWallet.walletId,
      accountId: typedWallet.accounts[0].accountId,
      address: typedWallet.accounts[0].address,
    };
  } catch (error) {
    console.error('[custodial-wallets] Failed to create Turnkey wallet:', error);
    throw new Error(
      `Failed to create custodial wallet for @${params.githubUsername}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Sign transaction with custodial wallet
 *
 * Signs an EVM transaction using a Turnkey-managed custodial wallet.
 * Similar to Access Key signing pattern - all signing happens via Turnkey API.
 *
 * Used for:
 * - Transferring funds from custodial wallet to user's passkey wallet (claim flow)
 * - Future: Any custodial wallet operations
 *
 * @param params.walletId - Turnkey wallet ID
 * @param params.tx - Transaction parameters
 * @param params.network - Network to sign for (testnet or mainnet)
 * @returns Raw signed transaction and hash
 */
export async function signWithCustodialWallet(params: {
  walletId: string;
  tx: {
    to: string;
    data: string;
    value: bigint;
    nonce: number;
  };
  network: 'testnet' | 'mainnet';
}): Promise<{ rawTransaction: `0x${string}`; hash: `0x${string}` }> {
  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID not configured');
  }

  try {
    // Serialize transaction for signing
    // We'll use viem's serializeTransaction
    const { serializeTransaction, keccak256 } = await import('viem');

    const serialized = serializeTransaction({
      to: params.tx.to as `0x${string}`,
      value: params.tx.value,
      data: params.tx.data as `0x${string}`,
      nonce: params.tx.nonce,
      chainId: TEMPO_CHAIN_ID,
      maxFeePerGas: BigInt('0x3B9ACA00'),
      maxPriorityFeePerGas: BigInt('0x3B9ACA00'),
      gas: BigInt('0x186A0'),
    });

    // Hash the serialized transaction
    const txHash = keccak256(serialized);

    // Sign using Turnkey API
    const result = await turnkey.signRawPayload({
      organizationId: process.env.TURNKEY_ORGANIZATION_ID,
      signWith: params.walletId,
      payload: txHash,
      encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
      hashFunction: 'HASH_FUNCTION_NO_OP', // Already hashed
    });

    // Type assertion for Turnkey response
    type SignRawPayloadResult = typeof result & {
      r: string;
      s: string;
      v: string;
    };

    const signature = result as SignRawPayloadResult;

    // Reconstruct signed transaction
    const { serializeTransaction: serializeWithSig } = await import('viem');
    const signedTx = serializeWithSig(
      {
        to: params.tx.to as `0x${string}`,
        value: params.tx.value,
        data: params.tx.data as `0x${string}`,
        nonce: params.tx.nonce,
        chainId: TEMPO_CHAIN_ID,
        maxFeePerGas: BigInt('0x3B9ACA00'),
        maxPriorityFeePerGas: BigInt('0x3B9ACA00'),
        gas: BigInt('0x186A0'),
      },
      {
        r: signature.r as `0x${string}`,
        s: signature.s as `0x${string}`,
        v: BigInt(signature.v),
      }
    );

    return {
      rawTransaction: signedTx,
      hash: keccak256(signedTx),
    };
  } catch (error) {
    console.error('[custodial-wallets] Failed to sign transaction:', error);
    throw new Error(
      `Failed to sign transaction with custodial wallet: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
