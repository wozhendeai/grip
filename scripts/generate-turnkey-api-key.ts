import { webcrypto } from 'node:crypto';

/**
 * Generate a P-256 key pair for Turnkey API authentication
 *
 * This script generates a standard P-256 (secp256r1) key pair for authenticating
 * with Turnkey's API. You'll register the PUBLIC key in Turnkey's dashboard and
 * keep the PRIVATE key secret in your environment variables.
 *
 * Usage:
 *   pnpm tsx scripts/generate-turnkey-api-key.ts
 *
 * Output:
 *   - Public key (compressed, hex): Register this in Turnkey dashboard
 *   - Private key (hex): Store in TURNKEY_API_PRIVATE_KEY environment variable
 *
 * Setup steps:
 *   1. Run this script to generate a key pair
 *   2. Go to Turnkey dashboard → API Keys → Create API Key
 *   3. Enter the public key from this script (66 chars, starts with 02 or 03)
 *   4. Set environment variables:
 *      TURNKEY_API_PUBLIC_KEY=<public_key_from_this_script>
 *      TURNKEY_API_PRIVATE_KEY=<private_key_from_this_script>
 */

async function generateP256KeyPair() {
  console.log('🔐 Generating P-256 key pair for Turnkey API authentication...\n');

  // Generate P-256 key pair using Web Crypto API
  const keyPair = await webcrypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['sign', 'verify']
  );

  // Export public key in raw format
  const publicKeyRaw = await webcrypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBytes = new Uint8Array(publicKeyRaw);

  // Compress public key (take x-coordinate + parity byte)
  // P-256 uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes) = 65 bytes
  // P-256 compressed public key: 0x02/0x03 || x (32 bytes) = 33 bytes
  const x = publicKeyBytes.slice(1, 33); // Skip 0x04 prefix, take x coordinate
  const y = publicKeyBytes.slice(33, 65); // y coordinate

  // Determine parity byte (0x02 if y is even, 0x03 if y is odd)
  const yLastByte = y[y.length - 1];
  const parityByte = yLastByte % 2 === 0 ? 0x02 : 0x03;

  // Build compressed public key
  const compressedPublicKey = new Uint8Array(33);
  compressedPublicKey[0] = parityByte;
  compressedPublicKey.set(x, 1);

  const publicKeyHex = Buffer.from(compressedPublicKey).toString('hex');

  // Export private key
  const privateKeyJwk = await webcrypto.subtle.exportKey('jwk', keyPair.privateKey);
  if (!privateKeyJwk.d) {
    throw new Error('Failed to export private key');
  }

  // Convert base64url to hex
  const privateKeyBytes = Buffer.from(privateKeyJwk.d, 'base64url');
  const privateKeyHex = privateKeyBytes.toString('hex');

  console.log('✅ Key pair generated successfully!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 PUBLIC KEY (register in Turnkey dashboard):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(publicKeyHex);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔒 PRIVATE KEY (store in environment variables):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(privateKeyHex);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Next steps:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('1. Go to Turnkey dashboard: https://app.turnkey.com');
  console.log('2. Navigate to: API Keys → Create API Key');
  console.log('3. Enter API key label: "bountylane-backend" (or your choice)');
  console.log('4. Paste the PUBLIC KEY from above (66 chars, starts with 02 or 03)');
  console.log('5. Add to your .env file:\n');
  console.log(`   TURNKEY_API_PUBLIC_KEY="${publicKeyHex}"`);
  console.log(`   TURNKEY_API_PRIVATE_KEY="${privateKeyHex}"`);
  console.log('   TURNKEY_ORGANIZATION_ID="<your_org_id_from_turnkey>"\n');
  console.log('6. Run: pnpm tsx scripts/init-turnkey-wallets.ts');
  console.log('\n⚠️  SECURITY: Never commit the PRIVATE KEY to version control!');
  console.log('   Keep it secret in environment variables only.\n');
}

// Run script
generateP256KeyPair().catch((error) => {
  console.error('❌ Failed to generate key pair:', error);
  process.exit(1);
});
