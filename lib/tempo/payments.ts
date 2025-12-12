import { encodeFunctionData, parseUnits, toHex } from 'viem';
import { TIP20_ABI } from './constants';

/**
 * Memo encoding for bounty payouts
 *
 * BountyLane memo format (32 bytes):
 * - bytes 0-7: Issue number (uint64, big-endian)
 * - bytes 8-15: PR number (uint64, big-endian)
 * - bytes 16-31: Contributor username (16 bytes, UTF-8, right-padded)
 *
 * This allows on-chain tracking of which issue/PR a payment relates to.
 */
export function encodeBountyMemo(params: {
  issueNumber: number;
  prNumber: number;
  username: string;
}): `0x${string}` {
  const memo = new Uint8Array(32);

  // Issue number (bytes 0-7, big-endian uint64)
  const issueBytes = new DataView(new ArrayBuffer(8));
  issueBytes.setBigUint64(0, BigInt(params.issueNumber), false);
  memo.set(new Uint8Array(issueBytes.buffer), 0);

  // PR number (bytes 8-15, big-endian uint64)
  const prBytes = new DataView(new ArrayBuffer(8));
  prBytes.setBigUint64(0, BigInt(params.prNumber), false);
  memo.set(new Uint8Array(prBytes.buffer), 8);

  // Username (bytes 16-31, UTF-8, right-padded with zeros)
  const usernameBytes = new TextEncoder().encode(params.username.slice(0, 16).padEnd(16, '\0'));
  memo.set(usernameBytes, 16);

  return toHex(memo) as `0x${string}`;
}

/**
 * Decode a bounty memo back to its components
 */
export function decodeBountyMemo(memo: `0x${string}`): {
  issueNumber: number;
  prNumber: number;
  username: string;
} {
  // Remove 0x prefix and convert to bytes
  const bytes = new Uint8Array(
    memo
      .slice(2)
      .match(/.{2}/g)
      ?.map((b) => Number.parseInt(b, 16)) ?? []
  );

  if (bytes.length !== 32) {
    throw new Error('Invalid memo length');
  }

  // Issue number (bytes 0-7)
  const issueView = new DataView(bytes.buffer, 0, 8);
  const issueNumber = Number(issueView.getBigUint64(0, false));

  // PR number (bytes 8-15)
  const prView = new DataView(bytes.buffer, 8, 8);
  const prNumber = Number(prView.getBigUint64(0, false));

  // Username (bytes 16-31)
  const usernameBytes = bytes.slice(16, 32);
  const username = new TextDecoder().decode(usernameBytes).replace(/\0+$/, ''); // Trim null padding

  return { issueNumber, prNumber, username };
}

/**
 * Memo encoding for direct payments
 *
 * Direct payment memo format (32 bytes):
 * - bytes 0-31: User message (UTF-8, right-padded with zeros)
 *
 * Unlike bounty memos (which encode structured data like issue#/PR#),
 * direct payment memos are simple user-provided messages.
 * Max length: 32 bytes (truncated if longer).
 */
export function encodeDirectPaymentMemo(message: string): `0x${string}` {
  const memo = new Uint8Array(32);

  // Encode message as UTF-8, truncate to 32 bytes if longer
  const encoder = new TextEncoder();
  const bytes = encoder.encode(message);
  memo.set(bytes.slice(0, 32));

  return toHex(memo) as `0x${string}`;
}

/**
 * Decode direct payment memo back to message
 */
export function decodeDirectPaymentMemo(memo: `0x${string}`): string {
  // Remove 0x prefix and convert to bytes
  const bytes = new Uint8Array(
    memo
      .slice(2)
      .match(/.{2}/g)
      ?.map((b) => Number.parseInt(b, 16)) ?? []
  );

  if (bytes.length !== 32) {
    throw new Error('Invalid memo length');
  }

  // Decode UTF-8 message and trim null padding
  const decoder = new TextDecoder();
  return decoder.decode(bytes).replace(/\0+$/, '');
}

/**
 * Build TIP-20 transferWithMemo call data
 *
 * This builds the transaction data for a TIP-20 transfer with memo.
 * The transaction still needs to be signed by the treasury passkey.
 */
export function buildTransferWithMemoData(params: {
  to: `0x${string}`;
  amount: bigint;
  memo: `0x${string}`;
}): `0x${string}` {
  return encodeFunctionData({
    abi: TIP20_ABI,
    functionName: 'transferWithMemo',
    args: [params.to, params.amount, params.memo],
  });
}

/**
 * Build complete payout transaction parameters
 *
 * Returns the transaction parameters ready for signing.
 * The actual signing happens client-side with WebAuthn passkey.
 */
export function buildPayoutTransaction(params: {
  tokenAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  amount: bigint;
  issueNumber: number;
  prNumber: number;
  username: string;
}): {
  to: `0x${string}`;
  data: `0x${string}`;
  memo: `0x${string}`;
  value: bigint;
} {
  const memo = encodeBountyMemo({
    issueNumber: params.issueNumber,
    prNumber: params.prNumber,
    username: params.username,
  });

  const data = buildTransferWithMemoData({
    to: params.recipientAddress,
    amount: params.amount,
    memo,
  });

  return {
    to: params.tokenAddress,
    data,
    memo,
    value: BigInt(0), // TIP-20 transfers don't use native value
  };
}

/**
 * Build complete direct payment transaction parameters
 *
 * Returns the transaction parameters ready for signing.
 * Used for person-to-person payments (not tied to bounties).
 */
export function buildDirectPaymentTransaction(params: {
  tokenAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  amount: bigint;
  message: string;
}): {
  to: `0x${string}`;
  data: `0x${string}`;
  memo: `0x${string}`;
  value: bigint;
} {
  const memo = encodeDirectPaymentMemo(params.message);

  const data = buildTransferWithMemoData({
    to: params.recipientAddress,
    amount: params.amount,
    memo,
  });

  return {
    to: params.tokenAddress,
    data,
    memo,
    value: BigInt(0), // TIP-20 transfers don't use native value
  };
}

/**
 * Parse amount string to wei-equivalent (6 decimals for USDC)
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, 6);
}

/**
 * Format wei-equivalent to USDC string
 */
export function formatUSDC(amount: bigint): string {
  const divisor = BigInt(1_000_000);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(6, '0');
  return `${whole}.${fractionStr}`;
}

export type PayoutParams = {
  tokenAddress: `0x${string}`;
  recipientAddress: `0x${string}`;
  amount: bigint;
  issueNumber: number;
  prNumber: number;
  username: string;
};
