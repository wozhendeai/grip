import type { BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware, createAuthEndpoint } from 'better-auth/api';
import { keccak256, toHex } from 'viem';
import type {
  TempoPluginConfig,
  CreateAccessKeyRequest,
  CreateAccessKeyResponse,
  ListAccessKeysRequest,
  ListAccessKeysResponse,
  GetAccessKeyResponse,
  RevokeAccessKeyRequest,
  RevokeAccessKeyResponse,
  AccessKeyStatus,
  ListPasskeysResponse,
  PasskeyWithAddress,
  ListKeysResponse,
  LoadKeyResponse,
  SaveKeyRequest,
  SaveKeyResponse,
} from './types';
import { KeyAuthorization } from 'tempo.ts/ox';
import { db } from '@/db';
import { accessKeys, activityLog } from '@/db/schema/business';
import { and, eq } from 'drizzle-orm';
import { getCurrentNetwork, getNetworkForInsert } from '@/db/network';

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
  createdAt: string; // ISO 8601 string from database
}

/**
 * Type guard for checking if response contains an error
 */
function isErrorResponse(response: unknown): response is { error: unknown } {
  return typeof response === 'object' && response !== null && 'error' in response;
}

/**
 * Convert base64url to hex format (for Tempo SDK)
 */
function base64UrlToHex(base64url: string): string {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  // Decode base64 to bytes
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  // Convert to hex
  return toHex(bytes);
}

/**
 * Convert base64 to hex format
 */
function base64ToHex(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return toHex(bytes);
}

/**
 * Tempo plugin for better-auth
 *
 * @param config - Plugin configuration
 */
export const tempo = (config: TempoPluginConfig) => {
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

    // API endpoints
    endpoints: {
      // POST /tempo/access-keys - Create Access Key
      createAccessKey: createAuthEndpoint(
        '/tempo/access-keys',
        {
          method: 'POST',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Parse request body
          const body = (await ctx.request?.json()) as CreateAccessKeyRequest;
          if (!body) {
            return ctx.json({ error: 'Invalid request body' }, { status: 400 });
          }
          const {
            keyId,
            chainId,
            keyType,
            expiry,
            limits,
            signature,
            label,
            network: requestNetwork,
          } = body;

          // Validate required fields
          if (!keyId || typeof chainId !== 'number' || typeof keyType !== 'number' || !signature) {
            return ctx.json(
              { error: 'keyId, chainId, keyType, and signature are required' },
              { status: 400 }
            );
          }

          if (!limits || typeof limits !== 'object') {
            return ctx.json({ error: 'limits object is required' }, { status: 400 });
          }

          // Validate chain ID if configured
          if (config.allowedChainIds && !config.allowedChainIds.includes(chainId)) {
            return ctx.json(
              { error: `Invalid chain ID. Allowed: ${config.allowedChainIds.join(', ')}` },
              { status: 400 }
            );
          }

          // Get network context
          const network = config.enableNetworkField
            ? requestNetwork || getNetworkForInsert()
            : undefined;

          // Verify keyId matches backend wallet address
          const expectedKeyId = await config.backendWallet.getAddress(network);
          if (keyId !== expectedKeyId) {
            return ctx.json(
              {
                error: `Invalid backend key ID. Expected ${expectedKeyId}${network ? ` for ${network}` : ''}`,
              },
              { status: 400 }
            );
          }

          // Convert limits to JSONB format
          const limitsJson: Record<string, { initial: string; remaining: string }> = {};
          for (const [token, amount] of Object.entries(limits)) {
            if (typeof amount !== 'string') {
              return ctx.json(
                { error: 'All limit amounts must be strings (wei values)' },
                { status: 400 }
              );
            }
            limitsJson[token] = {
              initial: amount,
              remaining: amount,
            };
          }

          // Encode KeyAuthorization message using Tempo SDK
          const keyTypeMap = { 0: 'secp256k1', 1: 'p256', 2: 'webAuthn' } as const;
          const authorization = KeyAuthorization.from({
            chainId: BigInt(chainId),
            type: keyTypeMap[keyType as 0 | 1 | 2],
            address: keyId as `0x${string}`,
            expiry: expiry ? Number(expiry) : undefined,
            limits: Object.entries(limits).map(([token, amount]) => ({
              token: token as `0x${string}`,
              limit: BigInt(amount as string),
            })),
          });

          const hash = KeyAuthorization.getSignPayload(authorization);

          // Check for existing active Access Key
          const whereConditions = [
            eq(accessKeys.userId, session.user.id),
            eq(accessKeys.backendWalletAddress, keyId),
            eq(accessKeys.status, 'active'),
          ];

          if (config.enableNetworkField && network) {
            whereConditions.push(eq(accessKeys.network, network as 'testnet' | 'mainnet'));
          }

          const existingKey = await db.query.accessKeys.findFirst({
            where: and(...whereConditions),
          });

          if (existingKey) {
            return ctx.json(
              {
                error:
                  'An active Access Key already exists for this account. Revoke it first to create a new one.',
              },
              { status: 409 }
            );
          }

          // Create Access Key record
          const [accessKey] = await db
            .insert(accessKeys)
            .values({
              network:
                config.enableNetworkField && network
                  ? (network as 'testnet' | 'mainnet')
                  : 'testnet',
              userId: session.user.id,
              backendWalletAddress: keyId,
              keyType: (keyType === 0 ? 'secp256k1' : keyType === 1 ? 'p256' : 'webauthn') as
                | 'secp256k1'
                | 'p256'
                | 'webauthn',
              chainId,
              expiry: expiry ? BigInt(expiry) : null,
              limits: limitsJson,
              authorizationSignature: signature,
              authorizationHash: hash,
              status: 'active' as const,
              label: label || config.accessKeyDefaults?.label || 'BountyLane Auto-pay',
            })
            .returning();

          // Log activity
          await db.insert(activityLog).values({
            eventType: 'access_key_created',
            userId: session.user.id,
            network: config.enableNetworkField && network ? network : null,
            metadata: {
              accessKeyId: accessKey.id,
              backendWalletAddress: keyId,
              limits: limitsJson,
              expiry: expiry || null,
              label: label || config.accessKeyDefaults?.label || 'BountyLane Auto-pay',
            },
          });

          return ctx.json({ accessKey } as CreateAccessKeyResponse);
        }
      ),

      // GET /tempo/access-keys - List Access Keys
      listAccessKeys: createAuthEndpoint(
        '/tempo/access-keys',
        {
          method: 'GET',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Parse query params
          if (!ctx.request?.url) {
            return ctx.json({ error: 'Invalid request' }, { status: 400 });
          }
          const url = new URL(ctx.request.url);
          const status = url.searchParams.get('status') as AccessKeyStatus | null;

          // Build where conditions
          const whereConditions = [eq(accessKeys.userId, session.user.id)];

          if (config.enableNetworkField) {
            const network = getCurrentNetwork();
            whereConditions.push(eq(accessKeys.network, network as 'testnet' | 'mainnet'));
          }

          if (status) {
            whereConditions.push(eq(accessKeys.status, status));
          }

          // Fetch Access Keys
          const keys = await db.query.accessKeys.findMany({
            where: and(...whereConditions),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          });

          return ctx.json({ accessKeys: keys } as ListAccessKeysResponse);
        }
      ),

      // GET /tempo/access-keys/:id - Get Access Key
      getAccessKey: createAuthEndpoint(
        '/tempo/access-keys/:id',
        {
          method: 'GET',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Get ID from path params
          const id = ctx.params?.id;
          if (!id) {
            return ctx.json({ error: 'Access Key ID required' }, { status: 400 });
          }

          // Build where conditions
          const whereConditions = [eq(accessKeys.id, id as string)];

          if (config.enableNetworkField) {
            const network = getCurrentNetwork();
            whereConditions.push(eq(accessKeys.network, network as 'testnet' | 'mainnet'));
          }

          // Fetch Access Key
          const accessKey = await db.query.accessKeys.findFirst({
            where: and(...whereConditions),
          });

          if (!accessKey) {
            return ctx.json({ error: 'Access Key not found' }, { status: 404 });
          }

          // Verify ownership
          if (accessKey.userId !== session.user.id) {
            return ctx.json({ error: 'Access denied' }, { status: 403 });
          }

          return ctx.json({ accessKey } as GetAccessKeyResponse);
        }
      ),

      // DELETE /tempo/access-keys/:id - Revoke Access Key
      revokeAccessKey: createAuthEndpoint(
        '/tempo/access-keys/:id',
        {
          method: 'DELETE',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Get ID from path params
          const id = ctx.params?.id;
          if (!id) {
            return ctx.json({ error: 'Access Key ID required' }, { status: 400 });
          }

          // Parse request body (optional reason)
          let reason: string | undefined;
          try {
            const body = (await ctx.request?.json()) as RevokeAccessKeyRequest | undefined;
            reason = body?.reason;
          } catch {
            // Body is optional for DELETE
          }

          // Build where conditions
          const whereConditions = [eq(accessKeys.id, id as string)];

          if (config.enableNetworkField) {
            const network = getCurrentNetwork();
            whereConditions.push(eq(accessKeys.network, network as 'testnet' | 'mainnet'));
          }

          // Fetch Access Key
          const accessKey = await db.query.accessKeys.findFirst({
            where: and(...whereConditions),
          });

          if (!accessKey) {
            return ctx.json({ error: 'Access Key not found' }, { status: 404 });
          }

          // Verify ownership
          if (accessKey.userId !== session.user.id) {
            return ctx.json({ error: 'Access denied' }, { status: 403 });
          }

          // Check if already revoked
          if (accessKey.status === 'revoked') {
            return ctx.json({ error: 'Access Key already revoked' }, { status: 400 });
          }

          // Revoke Access Key
          const [revokedKey] = await db
            .update(accessKeys)
            .set({
              status: 'revoked',
              revokedAt: new Date().toISOString(),
              revokedReason: reason || null,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(accessKeys.id, id as string))
            .returning();

          // Log activity
          await db.insert(activityLog).values({
            eventType: 'access_key_revoked',
            userId: session.user.id,
            network: config.enableNetworkField && accessKey.network ? accessKey.network : null,
            metadata: {
              accessKeyId: id,
              reason: reason || null,
            },
          });

          return ctx.json({ accessKey: revokedKey } as RevokeAccessKeyResponse);
        }
      ),

      // GET /tempo/passkeys - List Passkeys
      listPasskeys: createAuthEndpoint(
        '/tempo/passkeys',
        {
          method: 'GET',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Fetch passkeys for user
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
          })) as PasskeyWithAddress[];

          return ctx.json({ passkeys } as ListPasskeysResponse);
        }
      ),

      // GET /tempo/keymanager - List/Load Keys
      listKeys: createAuthEndpoint(
        '/tempo/keymanager',
        {
          method: 'GET',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Parse query params
          if (!ctx.request?.url) {
            return ctx.json({ error: 'Invalid request' }, { status: 400 });
          }
          const url = new URL(ctx.request.url);
          const credentialId = url.searchParams.get('credentialId');

          // If credentialId provided, load specific key
          if (credentialId) {
            const passkeys = (await ctx.context.adapter.findMany({
              model: 'passkey',
              where: [
                {
                  field: 'userId',
                  value: session.user.id,
                },
                {
                  field: 'credentialID',
                  value: credentialId,
                },
              ],
              limit: 1,
            })) as PasskeyRecord[];

            const passkey = passkeys[0];

            if (!passkey) {
              return ctx.json({ error: 'Key not found' }, { status: 404 });
            }

            // Convert to KeyManager format
            const response: LoadKeyResponse = {
              credentialId: passkey.credentialID,
              publicKey: base64ToHex(passkey.publicKey),
              address: passkey.tempoAddress || '',
            };

            return ctx.json(response);
          }

          // Otherwise, list all keys
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
          })) as PasskeyRecord[];

          // Convert to KeyManager format
          const keys = passkeys.map((p) => ({
            credentialId: p.credentialID,
            publicKey: base64ToHex(p.publicKey),
            address: p.tempoAddress || '',
          }));

          return ctx.json({ keys } as ListKeysResponse);
        }
      ),

      // POST /tempo/keymanager - Save Key
      saveKey: createAuthEndpoint(
        '/tempo/keymanager',
        {
          method: 'POST',
        },
        async (ctx) => {
          // Require authentication
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Parse request body
          const body = (await ctx.request?.json()) as SaveKeyRequest | undefined;
          if (!body) {
            return ctx.json({ error: 'Invalid request body' }, { status: 400 });
          }

          // Note: This endpoint is provided for SDK compatibility,
          // but passkey creation happens through Better Auth's passkey flow.
          // In most cases, passkeys are created during registration, not via this endpoint.

          return ctx.json({ success: true } as SaveKeyResponse);
        }
      ),
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
