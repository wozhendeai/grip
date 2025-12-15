import { accessKeys, db, payouts } from '@/db';
import { requireAuth } from '@/lib/auth-server';
import { getNetworkForInsert } from '@/lib/db/network';
import {
  createCustodialWalletRecord,
  getCustodialWalletByGithubUserId,
} from '@/lib/db/queries/custodial-wallets';
import { getUserWallet } from '@/lib/db/queries/passkeys';
import { createDirectPayment } from '@/lib/db/queries/payouts';
import { getUserByName } from '@/lib/db/queries/users';
import { fetchGitHubUser } from '@/lib/github/user';
import { notifyDirectPaymentReceived, notifyDirectPaymentSent } from '@/lib/notifications';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { buildDirectPaymentTransaction } from '@/lib/tempo/payments';
import { getNonce } from '@/lib/tempo/signing';
import { createCustodialWallet } from '@/lib/turnkey/custodial-wallets';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/payments/direct
 *
 * Send direct payment to GitHub user (with or without BountyLane account)
 *
 * Request body:
 * - recipientUsername: GitHub username
 * - amount: Payment amount in token smallest units (e.g., 1000000 = $1 USDC)
 * - tokenAddress: TIP-20 token address
 * - message: User-provided memo (max 32 bytes UTF-8)
 * - useAccessKey: Auto-sign with Access Key (default true)
 *
 * Response:
 * - autoSigned: true if Access Key auto-signed
 * - txHash: Transaction hash (if auto-signed)
 * - txParams: Transaction params for manual signing (if not auto-signed)
 * - custodial: true if recipient has no account
 * - recipient: { username, address }
 *
 * KEY TEMPO FEATURES DEMONSTRATED:
 * 1. Permissionless payments - Works for ANY GitHub user
 * 2. Access Key auto-signing - Backend signs on user's behalf
 * 3. Fee sponsorship - Sender pays gas in the token being transferred
 * 4. Custodial wallets - Recipients without accounts can claim later
 * 5. User memos - Personal messages on-chain
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { recipientUsername, amount, tokenAddress, message, useAccessKey = true } = body;

    // 1. Validation
    if (!recipientUsername || !amount || !tokenAddress || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    if (typeof message !== 'string' || message.length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // UTF-8 byte length check (not character length)
    // A 32-character string with emojis can exceed 32 bytes
    const messageBytes = new TextEncoder().encode(message);
    if (messageBytes.length > 32) {
      return NextResponse.json({ error: 'Message too long (max 32 bytes UTF-8)' }, { status: 400 });
    }

    // Prevent self-payment
    if (session.user.name === recipientUsername) {
      return NextResponse.json({ error: 'Cannot send payment to yourself' }, { status: 400 });
    }

    // 2. Lookup recipient by GitHub username
    const recipient = await getUserByName(recipientUsername);

    // 3. Verify recipient exists on GitHub (even if no BountyLane account)
    const githubUser = await fetchGitHubUser(recipientUsername);
    if (!githubUser) {
      return NextResponse.json({ error: 'GitHub user not found' }, { status: 404 });
    }

    // 4. Resolve recipient wallet or create custodial wallet
    let recipientAddress: string;
    let recipientPasskeyId: string | null = null;
    let custodialWalletId: string | undefined;
    let isCustodial = false;
    let recipientUserId: string;

    if (recipient?.tempoAddress) {
      // Recipient has BountyLane account + wallet
      recipientAddress = recipient.tempoAddress;
      recipientUserId = recipient.id;

      // Get passkey ID for the wallet
      const recipientWallet = await getUserWallet(recipient.id);
      recipientPasskeyId = recipientWallet?.id ?? null;
    } else {
      // Recipient has NO account → custodial wallet flow
      isCustodial = true;
      recipientUserId = recipient?.id ?? `github:${githubUser.id}`; // Synthetic ID if no account

      // Check for existing custodial wallet
      let custodialWallet = await getCustodialWalletByGithubUserId(BigInt(githubUser.id));

      if (!custodialWallet) {
        // Create new Turnkey wallet
        const { walletId, accountId, address } = await createCustodialWallet({
          githubUserId: githubUser.id,
          githubUsername: recipientUsername,
        });

        // Generate claim token (64-byte hex string)
        const crypto = await import('node:crypto');
        const claimToken = crypto.randomBytes(32).toString('hex');
        const claimExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

        custodialWallet = await createCustodialWalletRecord({
          githubUserId: BigInt(githubUser.id),
          githubUsername: recipientUsername,
          turnkeyWalletId: walletId,
          turnkeyAccountId: accountId,
          address,
          claimToken,
          claimExpiresAt,
        });
      }

      recipientAddress = custodialWallet.address;
      custodialWalletId = custodialWallet.id;
    }

    // 5. Create payout record
    const payout = await createDirectPayment({
      payerUserId: session.user.id,
      recipientUserId,
      recipientPasskeyId,
      recipientAddress,
      amount: BigInt(amount),
      tokenAddress,
      message,
      custodialWalletId,
      isCustodial,
    });

    // 6. Build transaction
    const txParams = buildDirectPaymentTransaction({
      tokenAddress: tokenAddress as `0x${string}`,
      recipientAddress: recipientAddress as `0x${string}`,
      amount: BigInt(amount.toString()),
      message,
    });

    // 7. Try Access Key auto-signing
    if (useAccessKey) {
      const network = getNetworkForInsert();

      const activeKey = await db.query.accessKeys.findFirst({
        where: and(
          eq(accessKeys.userId, session.user.id),
          eq(accessKeys.network, network),
          eq(accessKeys.status, 'active')
        ),
      });

      if (activeKey) {
        try {
          const senderWallet = await getUserWallet(session.user.id);
          if (!senderWallet?.tempoAddress) {
            throw new Error('Sender wallet not found');
          }

          const nonce = await getNonce(senderWallet.tempoAddress as `0x${string}`);

          const { rawTransaction } = await signTransactionWithAccessKey({
            tx: {
              to: txParams.to,
              data: txParams.data,
              value: txParams.value,
              nonce: BigInt(nonce),
            },
            funderAddress: senderWallet.tempoAddress as `0x${string}`,
            network: network as 'testnet' | 'mainnet',
          });

          const txHash = await broadcastTransaction(rawTransaction);

          // Update payout with transaction hash
          await db
            .update(payouts)
            .set({ txHash, status: 'pending' })
            .where(eq(payouts.id, payout.id));

          // Send notifications
          await notifyDirectPaymentSent({
            senderId: session.user.id,
            recipientUsername,
            amount: amount.toString(),
            message,
            txHash,
          });

          // Only notify recipient if they have a BountyLane account
          if (!isCustodial && recipient) {
            await notifyDirectPaymentReceived({
              recipientId: recipient.id,
              senderName: session.user.name ?? 'Someone',
              amount: amount.toString(),
              message,
              txHash,
            });
          }

          return NextResponse.json({
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
            custodial: isCustodial,
          });
        } catch (error) {
          console.error('[direct-payment] Auto-signing failed:', error);
          // Fall through to manual signing
        }
      }
    }

    // 8. Manual signing flow
    // Return transaction parameters for client-side passkey signing
    return NextResponse.json({
      message: 'Ready to sign payment',
      autoSigned: false,
      payout: {
        id: payout.id,
        amount: payout.amount,
        recipientAddress,
        status: 'pending',
      },
      txParams: {
        to: txParams.to,
        data: txParams.data,
        value: txParams.value.toString(),
      },
      recipient: {
        username: recipientUsername,
        address: recipientAddress,
      },
      custodial: isCustodial,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[direct-payment] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
