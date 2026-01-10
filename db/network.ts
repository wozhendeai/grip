import { type SQL, eq } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { getChainId, getNetworkName, isTestnet, TEMPO_CHAIN_IDS, type Network } from '@/lib/network';

// Re-export for convenience (server-side code can import from either location)
export { getChainId, getNetworkName, isTestnet, TEMPO_CHAIN_IDS, type Network } from '@/lib/network';

/**
 * Database network utilities (server-only)
 *
 * Provides Drizzle query helpers for testnet/mainnet separation.
 * Chain ID utilities are in @/lib/network (client-safe).
 *
 * All queries on network-aware tables (bounties, payouts, tokens, etc.)
 * MUST use chainIdFilter() to prevent cross-network data leakage.
 */

/**
 * Create chainId filter for Drizzle queries
 *
 * Usage:
 *   const bounties = await db.select()
 *     .from(bountiesTable)
 *     .where(and(
 *       chainIdFilter(bountiesTable),
 *       eq(bountiesTable.status, 'open')
 *     ));
 *
 * IMPORTANT: This must be used in ALL queries on network-aware tables
 * (bounties, payouts, tokens, etc.) to prevent showing testnet data
 * on mainnet and vice versa.
 *
 * @param table - Table with chainId column
 * @returns Drizzle condition for current network's chainId
 */
export function chainIdFilter<T extends { chainId: AnyPgColumn }>(table: T): SQL {
  return eq(table.chainId, getChainId());
}