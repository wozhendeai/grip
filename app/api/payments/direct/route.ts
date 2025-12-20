import { accessKeys, db, payouts } from '@/db';
import { getNetworkForInsert } from '@/db/network';
import { getUserWallet } from '@/db/queries/passkeys';
import { createDirectPayment } from '@/db/queries/payouts';
import { getUserByName } from '@/db/queries/users';
import { requireAuth } from '@/lib/auth/auth-server';
import { fetchGitHubUser } from '@/lib/github';
import { notifyDirectPaymentReceived, notifyDirectPaymentSent } from '@/lib/notifications';
import { buildDirectPaymentTransaction } from '@/lib/tempo';
import { tempoClient } from '@/lib/tempo/client';
import { TEMPO_CHAIN_ID } from '@/lib/tempo/constants';
import { broadcastTransaction, signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
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
    const isCustodial = false;
    let recipientUserId: string;

    if (recipient?.tempoAddress) {
      // Recipient has BountyLane account + wallet
      recipientAddress = recipient.tempoAddress;
      recipientUserId = recipient.id;

      // Get passkey ID for the wallet
      const recipientWallet = await getUserWallet(recipient.id);
      recipientPasskeyId = recipientWallet?.id ?? null;
    } else {
      // Recipient has NO account → pending payment flow
      // Same pattern as bounty approvals: create dedicated Access Key + pending payment
      console.log('[direct-payment] Recipient has no account - creating pending payment');

      const githubUserId = githubUser.id; // GitHub API returns numeric ID
      const githubUsername = recipientUsername;

      // Check for Access Key signature in request body
      const { accessKeySignature, accessKeyAuthHash } = body;

      if (!accessKeySignature || !accessKeyAuthHash) {
        // Return response indicating frontend needs to collect signature
        return NextResponse.json(
          {
            requiresAccessKeySignature: true,
            payment: {
              amount: amount.toString(),
              tokenAddress,
              recipientGithubUsername: githubUsername,
              recipientGithubUserId: githubUserId.toString(),
            },
          },
          { status: 400 }
        );
      }

      try {
        // Check balance before creating pending payment
        // Prevents bad UX: recipient claim fails on-chain if sender has insufficient balance
        const senderWallet = await getUserWallet(session.user.id);
        if (!senderWallet?.tempoAddress) {
          return NextResponse.json({ error: 'Sender wallet not found' }, { status: 400 });
        }

        const { checkSufficientBalance } = await import('@/lib/tempo/balance');
        const balanceCheck = await checkSufficientBalance({
          funderId: session.user.id,
          walletAddress: senderWallet.tempoAddress,
          tokenAddress,
          newAmount: BigInt(amount),
        });

        if (!balanceCheck.sufficient) {
          // Format amounts for error message (assuming 6 decimals for USDC)
          const balanceFormatted = (Number(balanceCheck.balance) / 1_000_000).toFixed(2);
          const requiredFormatted = (Number(balanceCheck.totalLiabilities) / 1_000_000).toFixed(2);
          const shortfallFormatted = (
            Number(balanceCheck.totalLiabilities - balanceCheck.balance) / 1_000_000
          ).toFixed(2);

          return NextResponse.json(
            {
              error: 'Insufficient balance for pending payment',
              details: {
                message: `You have $${balanceFormatted} USDC but need $${requiredFormatted} USDC (including existing pending payments). Please fund your wallet with at least $${shortfallFormatted} USDC more.`,
                balance: balanceCheck.balance.toString(),
                required: balanceCheck.totalLiabilities.toString(),
                shortfall: (balanceCheck.totalLiabilities - balanceCheck.balance).toString(),
              },
            },
            { status: 400 }
          );
        }

        // Create dedicated Access Key
        const { createDedicatedAccessKey } = await import('@/lib/tempo/dedicated-access-keys');
        const dedicatedKey = await createDedicatedAccessKey({
          userId: session.user.id,
          tokenAddress,
          amount: BigInt(amount),
          authorizationSignature: accessKeySignature,
          authorizationHash: accessKeyAuthHash,
          chainId: TEMPO_CHAIN_ID,
        });

        console.log(`[direct-payment] Created dedicated Access Key: ${dedicatedKey.id}`);

        // Create pending payment
        const { createPendingPaymentForDirectPayment } = await import(
          '@/db/queries/pending-payments'
        );
        const pendingPayment = await createPendingPaymentForDirectPayment({
          funderId: session.user.id,
          recipientGithubUserId: Number(githubUserId),
          recipientGithubUsername: githubUsername,
          amount: BigInt(amount),
          tokenAddress,
          dedicatedAccessKeyId: dedicatedKey.id,
        });

        console.log(`[direct-payment] Created pending payment: ${pendingPayment.id}`);

        // Send pending payment notification (if recipient has account)
        // Design Decision: Only notify if recipient already has BountyLane account (but no wallet)
        // - New users won't see notification anyway (not logged in)
        // - Sender gets claim URL in response for manual sharing
        try {
          const { getUserByName } = await import('@/db/queries/users');
          const recipientUser = await getUserByName(githubUsername);

          if (recipientUser) {
            // Recipient has account but no wallet - notify them
            const { notifyPendingPaymentCreated } = await import('@/lib/notifications');
            await notifyPendingPaymentCreated({
              recipientId: recipientUser.id,
              funderName: session.user.name ?? 'Someone',
              amount: amount.toString(),
              tokenAddress,
              claimUrl: `${process.env.NEXT_PUBLIC_APP_URL}/claim/${pendingPayment.claimToken}`,
              claimExpiresAt: pendingPayment.claimExpiresAt,
              // No bountyId/bountyTitle for direct payments
            });
          }
        } catch (error) {
          console.error('[direct-payment] Failed to send pending payment notification:', error);
        }

        return NextResponse.json({
          success: true,
          message: `Payment authorized. Share the claim link with @${githubUsername}`,
          pendingPayment: {
            id: pendingPayment.id,
            amount: pendingPayment.amount.toString(),
            tokenAddress: pendingPayment.tokenAddress,
            claimUrl: `${process.env.NEXT_PUBLIC_APP_URL}/claim/${pendingPayment.claimToken}`,
            claimExpiresAt: pendingPayment.claimExpiresAt,
          },
          recipient: {
            githubUserId: githubUserId.toString(),
            githubUsername,
          },
        });
      } catch (error) {
        console.error('[direct-payment] Failed to create pending payment:', error);
        return NextResponse.json({ error: 'Failed to create pending payment' }, { status: 500 });
      }
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

          const nonce = BigInt(
            await tempoClient.getTransactionCount({
              address: senderWallet.tempoAddress as `0x${string}`,
              blockTag: 'pending',
            })
          );

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
