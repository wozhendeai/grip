import { getFunderPendingLiabilities } from '@/db/queries/pending-payments';
import { tempoClient } from './client';

/**
 * Balance Check Utility
 *
 * Validates funder has sufficient balance for new pending payments.
 *
 * Why this check matters (preventing on-chain failures):
 * - Pending payments are commitments that auto-execute when contributor claims
 * - If balance < liabilities, claims fail on-chain (bad UX for contributor)
 * - Better to prevent payment creation than promise payment that won't execute
 * - Funder can fund wallet, then retry
 *
 * Design Decision: Block instead of warn
 * - Alternative rejected: Confirmation modal ("Are you sure?")
 * - Chosen approach: Hard block with clear error message
 * - Trade-off: Blocks legitimate payments if funder plans to fund later,
 *              but better UX overall (clear error vs confusing on-chain failure)
 */

/**
 * Check if funder has sufficient balance for new payment
 *
 * Validates: wallet balance >= existing liabilities + new payment amount
 *
 * @param funderId - User ID of funder
 * @param walletAddress - Funder's Tempo wallet address
 * @param tokenAddress - Token being sent
 * @param newAmount - Amount of new payment (BigInt)
 * @returns { sufficient: boolean, balance: bigint, totalLiabilities: bigint }
 */
export async function checkSufficientBalance(params: {
  funderId: string;
  walletAddress: string;
  tokenAddress: string;
  newAmount: bigint;
}): Promise<{
  sufficient: boolean;
  balance: bigint;
  totalLiabilities: bigint;
  newTotal: bigint;
}> {
  // Fetch balance and liabilities in parallel (optimization: ~200ms vs ~400ms sequential)
  const [balance, liabilities] = await Promise.all([
    tempoClient.token.getBalance({
      account: params.walletAddress as `0x${string}`,
      token: params.tokenAddress as `0x${string}`,
    }),
    getFunderPendingLiabilities(params.funderId),
  ]);

  // Find liability for this specific token (may not exist if first payment in this token)
  const tokenLiability = liabilities.find(
    (l) => l.tokenAddress.toLowerCase() === params.tokenAddress.toLowerCase()
  );
  const existingLiabilities = tokenLiability?.total ?? BigInt(0);

  const newTotal = existingLiabilities + params.newAmount;

  return {
    sufficient: balance >= newTotal,
    balance,
    totalLiabilities: newTotal,
    newTotal,
  };
}
