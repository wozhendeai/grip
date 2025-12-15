import { db } from '@/db';
import { type AccessKeyStatus, accessKeys, activityLog } from '@/db/schema/business';
import { requireAuth } from '@/lib/auth-server';
import { getCurrentNetwork, getNetworkForInsert } from '@/lib/db/network';
import { encodeKeyAuthorization } from '@/lib/tempo/access-keys';
import { getBackendWalletAddress } from '@/lib/turnkey/client';
import { and, eq, isNull } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { keccak256 } from 'viem';

/**
 * POST /api/access-keys
 *
 * Create a new Access Key authorization for the authenticated user.
 * User must have signed KeyAuthorization with their passkey.
 *
 * Body:
 * - keyId: string (backend wallet address)
 * - chainId: number (42429 for testnet)
 * - keyType: number (0=secp256k1, 1=P256, 2=WebAuthn)
 * - expiry?: number (Unix timestamp, optional)
 * - limits: Record<string, string> ({ "0xToken": "1000000000" })
 * - signature: string (WebAuthn signature)
 * - label?: string (optional user-friendly label)
 *
 * Returns:
 * - accessKey: The created access key record
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const network = getNetworkForInsert();
    const body = await request.json();

    const { keyId, chainId, keyType, expiry, limits, signature, label } = body;

    // Validate required fields
    if (!keyId || typeof chainId !== 'number' || typeof keyType !== 'number' || !signature) {
      return NextResponse.json(
        { error: 'keyId, chainId, keyType, and signature are required' },
        { status: 400 }
      );
    }

    if (!limits || typeof limits !== 'object') {
      return NextResponse.json({ error: 'limits object is required' }, { status: 400 });
    }

    // Verify keyId matches our backend wallet address for this network
    const expectedKeyId = await getBackendWalletAddress(network as 'testnet' | 'mainnet');
    if (keyId !== expectedKeyId) {
      return NextResponse.json(
        { error: `Invalid backend key ID. Expected ${expectedKeyId} for ${network}` },
        { status: 400 }
      );
    }

    // Convert limits to JSONB format
    // Input: { "0xToken": "1000000000" }
    // Output: { "0xToken": { initial: "1000000000", remaining: "1000000000" } }
    const limitsJson: Record<string, { initial: string; remaining: string }> = {};
    for (const [token, amount] of Object.entries(limits)) {
      if (typeof amount !== 'string') {
        return NextResponse.json(
          { error: 'All limit amounts must be strings (wei values)' },
          { status: 400 }
        );
      }
      limitsJson[token] = {
        initial: amount,
        remaining: amount,
      };
    }

    // Encode KeyAuthorization message to verify it matches signature
    const authParams = {
      chainId,
      keyType: keyType as 0 | 1 | 2,
      keyId: keyId as `0x${string}`,
      expiry: expiry ? BigInt(expiry) : undefined,
      limits: Object.entries(limits).map(([token, amount]) => [
        token as `0x${string}`,
        BigInt(amount as string),
      ]) as Array<[`0x${string}`, bigint]>,
    };

    const encoded = encodeKeyAuthorization(authParams);
    const hash = keccak256(encoded);

    // Check if user already has an active Access Key for this backend wallet
    const existingKey = await db.query.accessKeys.findFirst({
      where: and(
        eq(accessKeys.userId, session.user.id),
        eq(accessKeys.backendWalletAddress, keyId),
        eq(accessKeys.network, network),
        eq(accessKeys.status, 'active')
      ),
    });

    if (existingKey) {
      return NextResponse.json(
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
        network,
        userId: session.user.id,
        backendWalletAddress: keyId,
        keyType: keyType === 0 ? 'secp256k1' : keyType === 1 ? 'p256' : 'webauthn',
        chainId,
        expiry: expiry || null,
        limits: limitsJson,
        authorizationSignature: signature,
        authorizationHash: hash,
        status: 'active',
        label: label || 'BountyLane Auto-pay',
      })
      .returning();

    // Log activity
    await db.insert(activityLog).values({
      eventType: 'access_key_created',
      network,
      userId: session.user.id,
      metadata: {
        accessKeyId: accessKey.id,
        backendWalletAddress: keyId,
        limits: limitsJson,
        expiry: expiry || null,
        label: label || 'BountyLane Auto-pay',
      },
    });

    return NextResponse.json({ accessKey });
  } catch (error) {
    console.error('[access-keys] Error creating Access Key:', error);
    return NextResponse.json({ error: 'Failed to create Access Key' }, { status: 500 });
  }
}

/**
 * GET /api/access-keys
 *
 * List all Access Keys for the authenticated user (active, revoked, expired).
 *
 * Query params:
 * - status?: 'active' | 'revoked' | 'expired' (filter by status)
 *
 * Returns:
 * - accessKeys: Array of Access Key records
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const network = getCurrentNetwork();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build where conditions
    const conditions = [eq(accessKeys.userId, session.user.id), eq(accessKeys.network, network)];

    if (status) {
      conditions.push(eq(accessKeys.status, status as AccessKeyStatus));
    }

    // Fetch Access Keys
    const keys = await db.query.accessKeys.findMany({
      where: and(...conditions),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });

    return NextResponse.json({ accessKeys: keys });
  } catch (error) {
    console.error('[access-keys] Error fetching Access Keys:', error);
    return NextResponse.json({ error: 'Failed to fetch Access Keys' }, { status: 500 });
  }
}
