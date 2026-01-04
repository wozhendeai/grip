import { ApiKeyStamper } from '@turnkey/api-key-stamper';
import { TurnkeyApiClient } from '@turnkey/sdk-server';

/**
 * Turnkey client for HSM-backed backend key management
 *
 * GRIP uses Turnkey to securely store and sign with backend keys for Access Key authorization.
 * No private keys are stored on GRIP servers - all signing happens via Turnkey API.
 *
 * Setup required:
 * 1. Create Turnkey organization at https://app.turnkey.com
 * 2. Generate API key in dashboard
 * 3. Run `pnpm tsx scripts/init-turnkey-wallets.ts` to create backend wallets
 * 4. Set environment variables: TURNKEY_ORGANIZATION_ID, TURNKEY_API_PUBLIC_KEY, TURNKEY_API_PRIVATE_KEY
 */

/**
 * Initialize Turnkey client for server-side signing
 * Uses API key authentication for programmatic access
 */
function createTurnkeyClient() {
  if (!process.env.TURNKEY_API_PUBLIC_KEY || !process.env.TURNKEY_API_PRIVATE_KEY) {
    throw new Error(
      'Turnkey API credentials not configured. Set TURNKEY_API_PUBLIC_KEY and TURNKEY_API_PRIVATE_KEY'
    );
  }

  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID not configured');
  }

  const stamper = new ApiKeyStamper({
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  });

  return new TurnkeyApiClient({
    apiBaseUrl: 'https://api.turnkey.com',
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
    stamper,
  });
}

export const turnkey = createTurnkeyClient();

/**
 * Get GRIP's backend wallet address for given network
 *
 * Backend wallets are pre-created in Turnkey dashboard with naming convention:
 * - "bountylane-backend-testnet" for Tempo testnet
 * - "bountylane-backend-mainnet" for Tempo mainnet
 *
 * These wallets are used to sign Access Key transactions on behalf of funders
 * after they've granted authorization via KeyAuthorization.
 *
 * @param network - 'testnet' or 'mainnet'
 * @returns Ethereum address of backend wallet
 */
export async function getBackendWalletAddress(
  network: 'testnet' | 'mainnet'
): Promise<`0x${string}`> {
  const walletName = `bountylane-backend-${network}`;

  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    throw new Error('TURNKEY_ORGANIZATION_ID not configured');
  }

  // Query Turnkey for wallet
  const wallets = await turnkey.getWallets({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
  });

  const wallet = wallets.wallets.find((w) => w.walletName === walletName);
  if (!wallet) {
    console.error(
      `[turnkey] Backend wallet "${walletName}" not found. Run 'pnpm tsx scripts/init-turnkey-wallets.ts' to create it.`
    );
    throw new Error('Backend signing service unavailable');
  }

  // getWallets doesn't include accounts, need to fetch them separately
  const accountsResult = await turnkey.getWalletAccounts({
    organizationId: process.env.TURNKEY_ORGANIZATION_ID,
    walletId: wallet.walletId,
  });

  const account = accountsResult.accounts?.[0];
  if (!account?.address) {
    console.error(
      `[turnkey] No account in wallet "${walletName}". Run 'pnpm tsx scripts/init-turnkey-wallets.ts' to create one.`
    );
    throw new Error('Backend signing service unavailable');
  }

  return account.address as `0x${string}`;
}
