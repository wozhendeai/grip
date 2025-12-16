import { type SQL, eq } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Network context utilities
 *
 * Provides centralized network detection and filtering for testnet/mainnet separation.
 * Network is determined by NEXT_PUBLIC_TEMPO_NETWORK environment variable.
 *
 * Design decisions:
 * - Use NEXT_PUBLIC_ prefix for client-side access (required for Next.js)
 * - Default to 'testnet' for safety (won't accidentally write to mainnet)
 * - Type as literal 'testnet' | 'mainnet' for type safety
 * - All queries must use networkFilter() to prevent cross-network data leakage
 *
 * Deployment:
 * - testnet.tpay.xyz: NEXT_PUBLIC_TEMPO_NETWORK=testnet
 * - app.tpay.xyz: NEXT_PUBLIC_TEMPO_NETWORK=mainnet
 */

export type Network = 'testnet' | 'mainnet';

/**
 * Get current network from environment
 *
 * CRITICAL: This reads NEXT_PUBLIC_TEMPO_NETWORK which must be set correctly
 * for each deployment. Incorrect value will cause cross-network data leakage.
 *
 * @returns Current network ('testnet' or 'mainnet')
 */
export function getCurrentNetwork(): Network {
  const network = process.env.NEXT_PUBLIC_TEMPO_NETWORK;

  if (network !== 'testnet' && network !== 'mainnet') {
    console.warn(`Invalid NEXT_PUBLIC_TEMPO_NETWORK: ${network}, defaulting to testnet`);
    return 'testnet';
  }

  return network;
}

/**
 * Create network filter for Drizzle queries
 *
 * Usage:
 *   const bounties = await db.select()
 *     .from(bountiesTable)
 *     .where(and(
 *       networkFilter(bountiesTable),
 *       eq(bountiesTable.status, 'open')
 *     ));
 *
 * IMPORTANT: This must be used in ALL queries on network-aware tables
 * (bounties, payouts, payoutBatches) to prevent showing testnet data
 * on mainnet and vice versa.
 *
 * @param table - Table with network column
 * @returns Drizzle condition for current network
 */
export function networkFilter<T extends { network: AnyPgColumn }>(table: T): SQL {
  return eq(table.network, getCurrentNetwork());
}

/**
 * Get network for a new record
 *
 * Use when inserting records to ensure network is set correctly.
 *
 * Usage:
 *   await db.insert(bounties).values({
 *     network: getNetworkForInsert(),
 *     // ... other fields
 *   });
 *
 * @returns Current network value for database insertion
 */
export function getNetworkForInsert(): Network {
  return getCurrentNetwork();
}
