import 'server-only';

import { http, createClient, publicActions } from 'viem';
import { tempoTestnet } from 'viem/chains';
import { tempoActions } from 'viem/tempo';

/**
 * Tempo SDK Client
 *
 * Uses Tempo extensions built into viem (viem/tempo).
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
  chain: tempoTestnet,
  transport: http(process.env.TEMPO_RPC_URL ?? tempoTestnet.rpcUrls.default.http[0]),
})
  .extend(publicActions)
  .extend(tempoActions());
