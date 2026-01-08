import { db } from '@/db';
import { getCurrentNetwork, getNetworkForInsert } from '@/db/network';
import { accessKeys, activityLog } from '@/db/schema/business';
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from 'better-auth/api';
import { and, eq } from 'drizzle-orm';
import * as Address from 'ox/Address';
import * as PublicKey from 'ox/PublicKey';
import { KeyAuthorization } from 'ox/tempo';
import { decodeCredentialPublicKey, cose, isoBase64URL } from '@simplewebauthn/server/helpers';
import { toHex } from 'viem';
import type {
  AccessKeyStatus,
  CreateAccessKeyRequest,
  CreateAccessKeyResponse,
  GetAccessKeyResponse,
  ListAccessKeysResponse,
  ListKeysResponse,
  ListPasskeysResponse,
  LoadKeyResponse,
  PasskeyWithAddress,
  RevokeAccessKeyRequest,
  RevokeAccessKeyResponse,
  SaveKeyResponse,
  TempoPluginConfig,
} from './types';

// ============================================================================
// PUBLIC KEY CONVERSION
// ============================================================================
//
// WebAuthn stores public keys as COSE (CBOR-encoded maps with x/y at labels -2/-3).
// Tempo's wire format and address derivation expect raw coordinates (x || y).
//
// We convert at registration to derive tempoAddress: keccak256(x || y)[12:32]
// For SDK requests, we convert on-the-fly since it's fast and avoids storing duplicate data.
//
// Reference: https://docs.tempo.xyz/protocol/transactions/spec-tempo-transaction

/**
 * Convert standard base64 to base64url encoding.
 * better-auth stores publicKey in standard base64, but isoBase64URL expects base64url.
 */
function base64ToBase64url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Extract raw P-256 coordinates from a base64-encoded COSE public key.
 * Returns 64-byte hex string (x || y) for Tempo SDK consumption.
 */
export function coseKeyToHex(publicKeyBase64: string): `0x${string}` {
  const coseBytes = isoBase64URL.toBuffer(base64ToBase64url(publicKeyBase64), 'base64url');
  const coseKey = decodeCredentialPublicKey(coseBytes);

  if (!cose.isCOSEPublicKeyEC2(coseKey)) {
    throw new Error('Expected EC2 COSE key for P-256 passkey');
  }

  const x = coseKey.get(cose.COSEKEYS.x);
  const y = coseKey.get(cose.COSEKEYS.y);

  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
    throw new Error('Missing x or y coordinate in COSE key');
  }
  if (x.length !== 32 || y.length !== 32) {
    throw new Error(`Invalid P-256 coordinates: x=${x.length}, y=${y.length}`);
  }

  const combined = new Uint8Array(64);
  combined.set(x, 0);
  combined.set(y, 32);
  return toHex(combined) as `0x${string}`;
}

/**
 * Derive Tempo address from a base64-encoded COSE public key.
 * Uses Tempo's address derivation: keccak256(x || y)[12:32]
 */
export function deriveTempoAddress(publicKeyBase64: string): `0x${string}` {
  const publicKeyHex = coseKeyToHex(publicKeyBase64);
  const publicKey = PublicKey.fromHex(publicKeyHex);
  return Address.fromPublicKey(publicKey);
}

// ============================================================================
// TYPES
// ============================================================================

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
  createdAt: string;
}

function isErrorResponse(response: unknown): response is { error: unknown } {
  return typeof response === 'object' && response !== null && 'error' in response;
}

// ============================================================================
// PLUGIN
// ============================================================================

export const tempo = (config: TempoPluginConfig) => {
  return {
    id: 'tempo',

    schema: {
      passkey: {
        fields: {
          tempoAddress: {
            type: 'string',
            unique: true,
            required: false,
          },
          // TODO: Consider storing publicKeyHex to avoid re-computing on each request
        },
      },
    },

    endpoints: {
      createAccessKey: createAuthEndpoint(
        '/tempo/access-keys',
        { method: 'POST', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          const body = ctx.body as CreateAccessKeyRequest;
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

          if (!keyId || typeof chainId !== 'number' || typeof keyType !== 'number' || !signature) {
            return ctx.json(
              { error: 'keyId, chainId, keyType, and signature are required' },
              { status: 400 }
            );
          }

          if (config.allowedChainIds && !config.allowedChainIds.includes(chainId)) {
            return ctx.json(
              { error: `Invalid chain ID. Allowed: ${config.allowedChainIds.join(', ')}` },
              { status: 400 }
            );
          }

          const network = config.enableNetworkField
            ? requestNetwork || getNetworkForInsert()
            : undefined;

          const expectedKeyId = await config.backendWallet.getAddress(network);
          if (keyId !== expectedKeyId) {
            return ctx.json(
              {
                error: `Invalid backend key ID. Expected ${expectedKeyId}${network ? ` for ${network}` : ''}`,
              },
              { status: 400 }
            );
          }

          // Convert limits to JSONB format (limits are optional per Tempo spec)
          const limitsJson: Record<string, { initial: string; remaining: string }> = {};
          if (limits && typeof limits === 'object') {
            for (const [token, amount] of Object.entries(limits)) {
              if (typeof amount !== 'string') {
                return ctx.json(
                  { error: 'All limit amounts must be strings (wei values)' },
                  { status: 400 }
                );
              }
              limitsJson[token] = { initial: amount, remaining: amount };
            }
          }

          const keyTypeMap = { 0: 'secp256k1', 1: 'p256', 2: 'webAuthn' } as const;
          const authorization = KeyAuthorization.from({
            chainId: BigInt(chainId),
            type: keyTypeMap[keyType as 0 | 1 | 2],
            address: keyId as `0x${string}`,
            expiry: expiry ? Number(expiry) : undefined,
            limits: limits
              ? Object.entries(limits).map(([token, amount]) => ({
                  token: token as `0x${string}`,
                  limit: BigInt(amount as string),
                }))
              : undefined,
          });

          const hash = KeyAuthorization.getSignPayload(authorization);

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
              limits: Object.keys(limitsJson).length > 0 ? limitsJson : undefined,
              authorizationSignature: signature,
              authorizationHash: hash,
              status: 'active' as const,
              label: label || config.accessKeyDefaults?.label || 'GRIP Auto-pay',
            })
            .returning();

          await db.insert(activityLog).values({
            eventType: 'access_key_created',
            userId: session.user.id,
            network: config.enableNetworkField && network ? network : null,
            metadata: {
              accessKeyId: accessKey.id,
              backendWalletAddress: keyId,
              limits: limitsJson,
              expiry: expiry || null,
              label: label || config.accessKeyDefaults?.label || 'GRIP Auto-pay',
            },
          });

          return ctx.json({ accessKey } as CreateAccessKeyResponse);
        }
      ),

      listAccessKeys: createAuthEndpoint(
        '/tempo/access-keys',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          if (!ctx.request?.url) {
            return ctx.json({ error: 'Invalid request' }, { status: 400 });
          }

          const url = new URL(ctx.request.url);
          const status = url.searchParams.get('status') as AccessKeyStatus | null;

          const whereConditions = [eq(accessKeys.userId, session.user.id)];
          if (config.enableNetworkField) {
            whereConditions.push(
              eq(accessKeys.network, getCurrentNetwork() as 'testnet' | 'mainnet')
            );
          }
          if (status) {
            whereConditions.push(eq(accessKeys.status, status));
          }

          const keys = await db.query.accessKeys.findMany({
            where: and(...whereConditions),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
          });

          return ctx.json({ accessKeys: keys } as ListAccessKeysResponse);
        }
      ),

      getAccessKey: createAuthEndpoint(
        '/tempo/access-keys/:id',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          const id = ctx.params?.id;
          if (!id) {
            return ctx.json({ error: 'Access Key ID required' }, { status: 400 });
          }

          const whereConditions = [eq(accessKeys.id, id as string)];
          if (config.enableNetworkField) {
            whereConditions.push(
              eq(accessKeys.network, getCurrentNetwork() as 'testnet' | 'mainnet')
            );
          }

          const accessKey = await db.query.accessKeys.findFirst({
            where: and(...whereConditions),
          });

          if (!accessKey) {
            return ctx.json({ error: 'Access Key not found' }, { status: 404 });
          }
          if (accessKey.userId !== session.user.id) {
            return ctx.json({ error: 'Access denied' }, { status: 403 });
          }

          return ctx.json({ accessKey } as GetAccessKeyResponse);
        }
      ),

      revokeAccessKey: createAuthEndpoint(
        '/tempo/access-keys/:id',
        { method: 'DELETE', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          const id = ctx.params?.id;
          if (!id) {
            return ctx.json({ error: 'Access Key ID required' }, { status: 400 });
          }

          const body = ctx.body as RevokeAccessKeyRequest | undefined;
          const reason = body?.reason;

          const whereConditions = [eq(accessKeys.id, id as string)];
          if (config.enableNetworkField) {
            whereConditions.push(
              eq(accessKeys.network, getCurrentNetwork() as 'testnet' | 'mainnet')
            );
          }

          const accessKey = await db.query.accessKeys.findFirst({
            where: and(...whereConditions),
          });

          if (!accessKey) {
            return ctx.json({ error: 'Access Key not found' }, { status: 404 });
          }
          if (accessKey.userId !== session.user.id) {
            return ctx.json({ error: 'Access denied' }, { status: 403 });
          }
          if (accessKey.status === 'revoked') {
            return ctx.json({ error: 'Access Key already revoked' }, { status: 400 });
          }

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

          await db.insert(activityLog).values({
            eventType: 'access_key_revoked',
            userId: session.user.id,
            network: config.enableNetworkField && accessKey.network ? accessKey.network : null,
            metadata: { accessKeyId: id, reason: reason || null },
          });

          return ctx.json({ accessKey: revokedKey } as RevokeAccessKeyResponse);
        }
      ),

      listPasskeys: createAuthEndpoint(
        '/tempo/passkeys',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          const passkeys = (await ctx.context.adapter.findMany({
            model: 'passkey',
            where: [{ field: 'userId', value: session.user.id }],
            sortBy: { field: 'createdAt', direction: 'desc' },
          })) as PasskeyWithAddress[];

          return ctx.json({ passkeys } as ListPasskeysResponse);
        }
      ),

      // KeyManager endpoints using path params for SDK compatibility
      // SDK's KeyManager.http expects: GET/POST /{path}/:credentialId
      getPublicKey: createAuthEndpoint(
        '/tempo/keymanager/:credentialId',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          console.log('[KeyManager] getPublicKey called', {
            hasSession: !!session,
            userId: session?.user?.id,
            params: ctx.params,
            path: ctx.path,
          });

          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Extract credentialId from path params
          const credentialId = ctx.params?.credentialId;
          console.log('[KeyManager] credentialId from params:', credentialId);

          if (!credentialId) {
            return ctx.json({ error: 'Missing credentialId' }, { status: 400 });
          }

          const passkeys = (await ctx.context.adapter.findMany({
            model: 'passkey',
            where: [
              { field: 'userId', value: session.user.id },
              { field: 'credentialID', value: credentialId },
            ],
            limit: 1,
          })) as PasskeyRecord[];

          console.log('[KeyManager] found passkeys:', passkeys.length);

          const passkey = passkeys[0];
          if (!passkey) {
            return ctx.json({ error: 'Key not found' }, { status: 404 });
          }

          const publicKeyHex = coseKeyToHex(passkey.publicKey);

          // Verify the public key derives to the expected address
          const derivedAddress = deriveTempoAddress(passkey.publicKey);
          const addressMatch = derivedAddress.toLowerCase() === passkey.tempoAddress?.toLowerCase();

          console.log('[KeyManager] returning publicKey:', {
            credentialId: passkey.credentialID,
            publicKeyHex,
            storedAddress: passkey.tempoAddress,
            derivedAddress,
            addressMatch,
            rawPublicKeyBase64: `${passkey.publicKey.slice(0, 30)}...`,
          });

          if (!addressMatch) {
            console.error(
              '[KeyManager] ADDRESS MISMATCH! Public key does not derive to stored address'
            );
          }

          return ctx.json({
            credentialId: passkey.credentialID,
            publicKey: publicKeyHex,
            address: passkey.tempoAddress || '',
          } as LoadKeyResponse);
        }
      ),

      setPublicKey: createAuthEndpoint(
        '/tempo/keymanager/:credentialId',
        { method: 'POST', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          // Passkey creation happens through better-auth's WebAuthn flow
          // This endpoint exists for SDK compatibility but is a no-op
          return ctx.json({ success: true } as SaveKeyResponse);
        }
      ),

      // List all keys for the user (used by tempo-client, not SDK)
      listKeys: createAuthEndpoint(
        '/tempo/keymanager',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session;
          if (!session?.user) {
            return ctx.json({ error: 'Unauthorized' }, { status: 401 });
          }

          const passkeys = (await ctx.context.adapter.findMany({
            model: 'passkey',
            where: [{ field: 'userId', value: session.user.id }],
            sortBy: { field: 'createdAt', direction: 'desc' },
          })) as PasskeyRecord[];

          const keys = passkeys.map((p) => ({
            credentialId: p.credentialID,
            publicKey: coseKeyToHex(p.publicKey),
            address: p.tempoAddress || '',
          }));

          return ctx.json({ keys } as ListKeysResponse);
        }
      ),
    },

    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path === '/passkey/verify-registration',
          handler: createAuthMiddleware(async (ctx) => {
            const response = ctx.context.returned;
            if (!response || isErrorResponse(response)) return;

            try {
              const session = ctx.context.session;
              if (!session?.user?.id) {
                console.error('[tempo] No session found after passkey registration');
                return;
              }

              const passkeys = (await ctx.context.adapter.findMany({
                model: 'passkey',
                where: [{ field: 'userId', value: session.user.id }],
                sortBy: { field: 'createdAt', direction: 'desc' },
                limit: 1,
              })) as PasskeyRecord[];

              if (!passkeys?.length) {
                console.error('[tempo] No passkey found after registration');
                return;
              }

              const passkey = passkeys[0];
              if (passkey.tempoAddress) return; // Already processed

              const tempoAddress = deriveTempoAddress(passkey.publicKey);

              await ctx.context.adapter.update({
                model: 'passkey',
                where: [{ field: 'id', value: passkey.id }],
                update: { tempoAddress },
              });

              console.log(`[tempo] Derived ${tempoAddress} for passkey ${passkey.id}`);
            } catch (error) {
              console.error('[tempo] Failed to derive address:', error);
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
