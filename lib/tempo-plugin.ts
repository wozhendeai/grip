import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { keccak256, toHex } from 'viem';

/**
 * Tempo Plugin for better-auth
 *
 * Extends the passkey functionality to derive Tempo blockchain addresses
 * from WebAuthn P256 public keys.
 *
 * Flow:
 * 1. User registers a passkey (WebAuthn/P256)
 * 2. After hook extracts the public key from the passkey
 * 3. Derives Tempo address: keccak256(x || y).slice(-40)
 * 4. Updates passkey record with tempoAddress
 */

// COSE key type constants for P-256 (ES256)
const COSE_KEY_TYPE = {
  kty: 1, // Key type
  alg: 3, // Algorithm
  x: -2, // X coordinate
  y: -3, // Y coordinate
};

/**
 * Decode a CBOR-encoded COSE public key
 * Simplified decoder for P-256 keys only
 */
function decodeCosePublicKey(publicKeyBytes: Uint8Array): { x: Uint8Array; y: Uint8Array } {
  // COSE keys are CBOR-encoded maps
  // For P-256, we expect a map with kty=2 (EC), alg=-7 (ES256), crv=1 (P-256), x, y

  // Simple CBOR map decoder for COSE keys
  // CBOR map starts with 0xa5 (map with 5 items) for typical P-256 keys
  let offset = 0;

  // Read the initial byte to determine map size
  const initialByte = publicKeyBytes[offset++];
  const majorType = initialByte >> 5;
  const additionalInfo = initialByte & 0x1f;

  if (majorType !== 5) {
    throw new Error('Expected CBOR map for COSE key');
  }

  // Get map item count
  let mapSize: number;
  if (additionalInfo < 24) {
    mapSize = additionalInfo;
  } else if (additionalInfo === 24) {
    mapSize = publicKeyBytes[offset++];
  } else {
    throw new Error('Unsupported map size encoding');
  }

  let x: Uint8Array | undefined;
  let y: Uint8Array | undefined;

  // Parse map entries
  for (let i = 0; i < mapSize; i++) {
    // Read key (should be a small negative or positive integer)
    const keyByte = publicKeyBytes[offset++];
    const keyMajorType = keyByte >> 5;
    const keyAdditionalInfo = keyByte & 0x1f;

    let key: number;
    if (keyMajorType === 0) {
      // Positive integer
      key = keyAdditionalInfo < 24 ? keyAdditionalInfo : publicKeyBytes[offset++];
    } else if (keyMajorType === 1) {
      // Negative integer: -1 - n
      const n = keyAdditionalInfo < 24 ? keyAdditionalInfo : publicKeyBytes[offset++];
      key = -1 - n;
    } else {
      throw new Error(`Unexpected CBOR key type: ${keyMajorType}`);
    }

    // Read value
    const valueByte = publicKeyBytes[offset++];
    const valueMajorType = valueByte >> 5;
    const valueAdditionalInfo = valueByte & 0x1f;

    if (valueMajorType === 2) {
      // Byte string - this is what we want for x and y coordinates
      let length: number;
      if (valueAdditionalInfo < 24) {
        length = valueAdditionalInfo;
      } else if (valueAdditionalInfo === 24) {
        length = publicKeyBytes[offset++];
      } else {
        throw new Error('Unsupported byte string length encoding');
      }

      const bytes = publicKeyBytes.slice(offset, offset + length);
      offset += length;

      if (key === COSE_KEY_TYPE.x) {
        x = bytes;
      } else if (key === COSE_KEY_TYPE.y) {
        y = bytes;
      }
    } else if (valueMajorType === 0) {
      // Positive integer (for kty, crv)
      if (valueAdditionalInfo >= 24) {
        offset++; // Skip extended value byte
      }
    } else if (valueMajorType === 1) {
      // Negative integer (for alg)
      if (valueAdditionalInfo >= 24) {
        offset++; // Skip extended value byte
      }
    } else {
      throw new Error(`Unexpected CBOR value type: ${valueMajorType}`);
    }
  }

  if (!x || !y) {
    throw new Error('Missing x or y coordinate in COSE key');
  }

  if (x.length !== 32 || y.length !== 32) {
    throw new Error(`Invalid coordinate length: x=${x.length}, y=${y.length}`);
  }

  return { x, y };
}

/**
 * Derive Tempo address from P256 public key coordinates
 *
 * Uses the same algorithm as Ethereum address derivation:
 * 1. Concatenate x and y coordinates (64 bytes)
 * 2. Hash with keccak256
 * 3. Take last 20 bytes (40 hex chars)
 */
export function deriveTempoAddress(publicKeyBytes: Uint8Array): `0x${string}` {
  const { x, y } = decodeCosePublicKey(publicKeyBytes);

  // Concatenate x || y (64 bytes total)
  const combined = new Uint8Array(64);
  combined.set(x, 0);
  combined.set(y, 32);

  // keccak256 hash
  const hash = keccak256(toHex(combined));

  // Take last 40 hex chars (20 bytes) as address
  return `0x${hash.slice(-40)}` as `0x${string}`;
}

/**
 * Passkey record type for better-auth
 */
interface PasskeyRecord {
  id: string;
  userId: string;
  name: string | null;
  publicKey: string;
  credentialID: string;
  counter: number;
  deviceType: string | null;
  backedUp: boolean;
  transports: string | null;
  tempoAddress: string | null;
  createdAt: Date;
}

/**
 * Type guard for checking if response contains an error
 */
function isErrorResponse(response: unknown): response is { error: unknown } {
  return typeof response === 'object' && response !== null && 'error' in response;
}

/**
 * Tempo plugin for better-auth
 */
export const tempo = () => {
  return {
    id: 'tempo',

    // Extend passkey table with tempoAddress column
    schema: {
      passkey: {
        fields: {
          tempoAddress: {
            type: 'string',
            unique: true,
            required: false,
          },
        },
      },
    },

    // Hook into passkey registration to derive address
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === '/passkey/verify-registration',
          handler: createAuthMiddleware(async (ctx) => {
            // Get the response from the passkey registration
            const response = ctx.context.returned;

            // Check if registration was successful
            if (!response || isErrorResponse(response)) {
              return;
            }

            // The passkey was just created - we need to fetch it and update with address
            // The response should contain the passkey ID or we can get it from the session
            try {
              const session = ctx.context.session;
              if (!session?.user?.id) {
                console.error('[tempo] No session found after passkey registration');
                return;
              }

              // Find the most recently created passkey for this user
              const passkeys = (await ctx.context.adapter.findMany({
                model: 'passkey',
                where: [
                  {
                    field: 'userId',
                    value: session.user.id,
                  },
                ],
                sortBy: {
                  field: 'createdAt',
                  direction: 'desc',
                },
                limit: 1,
              })) as PasskeyRecord[];

              if (!passkeys || passkeys.length === 0) {
                console.error('[tempo] No passkey found after registration');
                return;
              }

              const passkey = passkeys[0];

              // Skip if already has a tempo address
              if (passkey.tempoAddress) {
                return;
              }

              // The public key is stored as base64 in better-auth
              const publicKeyBase64 = passkey.publicKey;
              const publicKeyBytes = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));

              // Derive Tempo address
              const tempoAddress = deriveTempoAddress(publicKeyBytes);

              // Update passkey with tempo address
              await ctx.context.adapter.update({
                model: 'passkey',
                where: [
                  {
                    field: 'id',
                    value: passkey.id,
                  },
                ],
                update: {
                  tempoAddress,
                },
              });

              console.log(`[tempo] Derived address ${tempoAddress} for passkey ${passkey.id}`);
            } catch (error) {
              console.error('[tempo] Failed to derive address:', error);
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
