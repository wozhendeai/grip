import 'server-only';

import { tempo } from 'tempo.ts/chains';
import { tempoActions } from 'tempo.ts/viem';
import { http, createClient, publicActions } from 'viem';

/**
 * Tempo SDK Client
 *
 * Uses the official tempo.ts SDK via viem extensions.
 *
 * Instead of wrapper functions, use the client directly:
 * - `tempoClient.token.getBalance({ account, token })` - Get TIP-20 balance
 * - `tempoClient.token.getMetadata({ token })` - Get token info (decimals, symbol)
 * - `tempoClient.getTransactionCount({ address, blockTag: 'pending' })` - Get nonce
 * - `tempoClient.waitForTransactionReceipt({ hash, timeout })` - Wait for confirmation
 * - `tempoClient.getGasPrice()` - Get current gas price
 *
 * See: https://docs.tempo.xyz/sdk/typescript/viem/setup
 */
export const tempoClient = createClient({
  chain: tempo(),
  transport: http(process.env.TEMPO_RPC_URL ?? 'https://rpc.testnet.tempo.xyz'),
})
  .extend(publicActions)
  .extend(tempoActions());
