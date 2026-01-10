import { db } from '@/db';
import { getNetworkName } from '@/db/network';
import { getOrgAccessKey, getOrgWalletAddress } from '@/db/queries/organizations';
import { getUserWallet } from '@/db/queries/passkeys';
import { createDirectPayment } from '@/db/queries/payouts';
import { getUserByName } from '@/db/queries/users';
import { payouts } from '@/db/schema/business';
import { accessKey } from '@/db/schema/auth';
import { chainIdFilter } from '@/db/network';
import { auth } from '@/lib/auth/auth';
import { requireAuth } from '@/lib/auth/auth-server';
import { fetchGitHubUser } from '@/lib/github';
import { notifyDirectPaymentReceived, notifyDirectPaymentSent } from '@/lib/notifications';
import { tempoClient } from '@/lib/tempo/client';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { buildDirectPaymentTransaction } from '@/lib/tempo/payments';
import { handleRouteError, validateBody } from '@/app/api/_lib';
import { directPaymentSchema } from '@/app/api/_lib/schemas';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

/**
 * POST /api/payments/direct
 *
 * Send direct payment to GitHub user.
 * Recipient must have a wallet (be signed up on the platform).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await validateBody(request, directPaymentSchema);

    const { recipientUsername, amount, tokenAddress, message, useAccessKey = true } = body;

    // Prevent self-payment
    if (session.user.name === recipientUsername) {
      return Response.json({ error: 'Cannot send payment to yourself' }, { status: 400 });
    }

    const isOrgPayment = !!session.session?.activeOrganizationId;
    const activeOrgId = session.session?.activeOrganizationId;

    // Fetch sender wallet via tempo plugin API
    let senderWallet: { address: string; passkeyId: string | null } | null = null;
    if (!isOrgPayment) {
      const headersList = await headers();
      const { wallets } = await auth.api.listWallets({ headers: headersList });
      const passkeyWallet = wallets.find((w) => w.walletType === 'passkey');
      if (!passkeyWallet?.address) {
        return Response.json({ error: 'Sender wallet not found' }, { status: 400 });
      }
      senderWallet = { address: passkeyWallet.address, passkeyId: passkeyWallet.passkeyId ?? null };
    }

    // Verify recipient exists on GitHub
    const githubUser = await fetchGitHubUser(recipientUsername);
    if (!githubUser) {
      return Response.json({ error: 'GitHub user not found' }, { status: 404 });
    }

    // Check if recipient has GRIP account + wallet (REQUIRED)
    const recipient = await getUserByName(recipientUsername);
    if (!recipient?.tempoAddress) {
      return Response.json(
        { error: 'Recipient must create a wallet before receiving payment' },
        { status: 400 }
      );
    }

    // Recipient has wallet → proceed with payment
    const recipientWallet = await getUserWallet(recipient.id);

    const payout = await createDirectPayment({
      payerUserId: isOrgPayment ? undefined : session.user.id,
      payerOrganizationId: isOrgPayment ? (activeOrgId ?? undefined) : undefined,
      recipientUserId: recipient.id,
      recipientPasskeyId: recipientWallet?.id ?? null,
      recipientAddress: recipient.tempoAddress,
      amount: BigInt(amount),
      tokenAddress,
      message,
      isCustodial: false,
    });

    const txParams = buildDirectPaymentTransaction({
      tokenAddress: tokenAddress as `0x${string}`,
      recipientAddress: recipient.tempoAddress as `0x${string}`,
      amount: BigInt(amount),
      message,
    });

    // Try auto-signing
    if (useAccessKey) {
      const autoSignResult = await tryAutoSign({
        session,
        senderWalletAddress: senderWallet?.address ?? undefined,
        payout,
        txParams,
        recipientUsername,
        recipientAddress: recipient.tempoAddress,
        recipientId: recipient.id,
        amount,
        message,
        isOrgPayment,
        activeOrgId,
      });
      if (autoSignResult) return autoSignResult;
    }

    // Manual signing fallback
    return Response.json({
      message: 'Ready to sign payment',
      autoSigned: false,
      payout: {
        id: payout.id,
        amount: payout.amount,
        recipientAddress: recipient.tempoAddress,
        status: 'pending',
      },
      txParams: {
        to: txParams.to,
        data: txParams.data,
        value: txParams.value.toString(),
      },
      recipient: {
        username: recipientUsername,
        address: recipient.tempoAddress,
      },
    });
  } catch (error) {
    return handleRouteError(error, 'sending payment');
  }
}

type AutoSignParams = {
  session: Awaited<ReturnType<typeof requireAuth>>;
  senderWalletAddress?: string;
  payout: Awaited<ReturnType<typeof createDirectPayment>>;
  txParams: ReturnType<typeof buildDirectPaymentTransaction>;
  recipientUsername: string;
  recipientAddress: string;
  recipientId: string;
  amount: number;
  message: string;
  isOrgPayment: boolean;
  activeOrgId?: string | null;
};

async function tryAutoSign(params: AutoSignParams): Promise<Response | null> {
  const {
    session,
    senderWalletAddress: personalWallet,
    payout,
    txParams,
    recipientUsername,
    recipientAddress,
    recipientId,
    amount,
    message,
    isOrgPayment,
    activeOrgId,
  } = params;
  const network = getNetworkName();

  // Get active Access Key
  let activeKey: typeof accessKey.$inferSelect | null | undefined;
  if (isOrgPayment && activeOrgId) {
    activeKey = await getOrgAccessKey(activeOrgId, session.user.id);
  } else {
    activeKey = await db.query.accessKey.findFirst({
      where: and(
        eq(accessKey.userId, session.user.id),
        chainIdFilter(accessKey),
        eq(accessKey.status, 'active')
      ),
    });
  }

  if (!activeKey) return null;

  try {
    const senderWalletAddress =
      isOrgPayment && activeOrgId
        ? await getOrgWalletAddress(activeOrgId)
        : (personalWallet as `0x${string}`);

    if (!senderWalletAddress) throw new Error('Sender wallet not found');

    const nonce = BigInt(
      await tempoClient.getTransactionCount({ address: senderWalletAddress, blockTag: 'pending' })
    );

    const { rawTransaction } = await signTransactionWithAccessKey({
      tx: { to: txParams.to, data: txParams.data, value: txParams.value, nonce },
      funderAddress: senderWalletAddress,
      network: network as 'testnet' | 'mainnet',
    });

    const txHash = await broadcastTransaction(rawTransaction);

    await db.update(payouts).set({ txHash, status: 'pending' }).where(eq(payouts.id, payout.id));

    // Send notifications (fire-and-forget)
    notifyDirectPaymentSent({
      senderId: session.user.id,
      recipientUsername,
      amount: amount.toString(),
      message,
      txHash,
    }).catch((err) => console.error('[direct-payment] Send notification failed:', err));

    notifyDirectPaymentReceived({
      recipientId,
      senderName: session.user.name ?? 'Someone',
      amount: amount.toString(),
      message,
      txHash,
    }).catch((err) => console.error('[direct-payment] Receive notification failed:', err));

    return Response.json({
      message: 'Payment sent successfully',
      autoSigned: true,
      payout: {
        id: payout.id,
        amount: payout.amount,
        recipientAddress,
        status: 'pending',
        txHash,
      },
      recipient: {
        username: recipientUsername,
        address: recipientAddress,
      },
    });
  } catch (error) {
    console.error('[direct-payment] Auto-signing failed:', error);
    return null;
  }
}
