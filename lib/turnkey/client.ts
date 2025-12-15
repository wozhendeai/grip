import { ApiKeyStamper } from '@turnkey/api-key-stamper';
import { TurnkeyApiClient } from '@turnkey/sdk-server';

/**
 * Turnkey client for HSM-backed backend key management
 *
 * BountyLane uses Turnkey to securely store and sign with backend keys for Access Key authorization.
 * No private keys are stored on BountyLane servers - all signing happens via Turnkey API.
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
 * Get BountyLane's backend wallet address for given network
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

  // Type assertion: Turnkey SDK types don't include 'accounts' property
  // but the API actually returns it. This is a known gap in @turnkey/sdk-server types.
  // Runtime structure: { walletId, walletName, accounts: [{ address, ... }], ... }
  type WalletWithAccounts = {
    walletName: string;
    accounts?: Array<{ address: string }>;
  };

  const wallet = wallets.wallets.find((w) => w.walletName === walletName) as
    | WalletWithAccounts
    | undefined;
  if (!wallet || !wallet.accounts?.[0]) {
    throw new Error(
      `Backend wallet not found for ${network}. ` +
        `Run 'pnpm tsx scripts/init-turnkey-wallets.ts' to create wallet "${walletName}"`
    );
  }

  return wallet.accounts[0].address as `0x${string}`;
}
