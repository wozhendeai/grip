import { turnkey } from '@/lib/turnkey/client';

/**
 * Initialize BountyLane backend wallets in Turnkey
 *
 * This script creates the backend wallets used for Access Key signing.
 * Run this ONCE during initial Turnkey setup.
 *
 * Prerequisites:
 * 1. Turnkey organization created at https://app.turnkey.com
 * 2. API key generated in Turnkey dashboard
 * 3. Environment variables set:
 *    - TURNKEY_ORGANIZATION_ID
 *    - TURNKEY_API_PUBLIC_KEY
 *    - TURNKEY_API_PRIVATE_KEY
 *
 * Usage:
 *   pnpm tsx scripts/init-turnkey-wallets.ts
 *
 * Created wallets:
 *   - bountylane-backend-testnet (Tempo testnet, chain ID 42429)
 *   - bountylane-backend-mainnet (Tempo mainnet)
 */
async function initializeTurnkeyWallets() {
  console.log('🔐 Initializing BountyLane backend wallets in Turnkey...\n');

  if (!process.env.TURNKEY_ORGANIZATION_ID) {
    console.error('❌ Error: TURNKEY_ORGANIZATION_ID not set');
    console.error('   Set this environment variable and try again');
    process.exit(1);
  }

  const orgId = process.env.TURNKEY_ORGANIZATION_ID;

  for (const network of ['testnet', 'mainnet'] as const) {
    const walletName = `bountylane-backend-${network}`;

    try {
      console.log(`📝 Creating wallet: ${walletName}...`);

      // Create wallet with secp256k1 key for Ethereum-compatible signing
      // Turnkey stores the key in HSM - we only get the address back
      const result = await turnkey.createWallet({
        organizationId: orgId,
        walletName,
        accounts: [
          {
            curve: 'CURVE_SECP256K1',
            pathFormat: 'PATH_FORMAT_BIP32',
            path: "m/44'/60'/0'/0/0", // Standard Ethereum derivation path
            addressFormat: 'ADDRESS_FORMAT_ETHEREUM',
          },
        ],
      });

      console.log(`✅ Created wallet for ${network}`);
      console.log(`   Wallet ID: ${result.walletId}`);
      console.log(`   Address: ${result.addresses[0]}`);
      console.log('');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log(`⚠️  Wallet "${walletName}" already exists, skipping...`);
        console.log('');
      } else {
        console.error(`❌ Failed to create wallet for ${network}:`, error);
        throw error;
      }
    }
  }

  console.log('✅ Turnkey wallet initialization complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Verify wallets in Turnkey dashboard: https://app.turnkey.com');
  console.log('2. Copy wallet addresses to your documentation');
  console.log('3. Backend is now ready to sign Access Key transactions');
}

// Run script
initializeTurnkeyWallets().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
