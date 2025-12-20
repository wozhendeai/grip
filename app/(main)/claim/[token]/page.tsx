import { getUserWallet } from '@/db/queries/passkeys';
import { getPendingPaymentByClaimToken } from '@/db/queries/pending-payments';
import { getSession } from '@/lib/auth/auth-server';
import { ClaimError } from './_components/claim-error';
import { ClaimGithubMismatch } from './_components/claim-github-mismatch';
import { ClaimLoginPrompt } from './_components/claim-login-prompt';
import { ClaimPayment } from './_components/claim-payment';
import { CreateWalletForClaim } from './_components/create-wallet-for-claim';

/**
 * Claim Page
 *
 * Handles the claim flow for contributors who received pending payments.
 * The flow is:
 *
 * 1. Verify claim token is valid
 * 2. Check if user is authenticated
 * 3. Verify GitHub identity matches
 * 4. Check if user has a passkey wallet
 * 5. Show claim button to execute payment from funder's wallet
 *
 * This demonstrates Tempo's Access Keys: funder pre-authorized payment with dedicated Access Key.
 * Funds stay in funder's wallet until claim (non-custodial).
 */

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ClaimPage({ params }: PageProps) {
  const { token } = await params;

  // 1. Verify claim token
  const pendingPayment = await getPendingPaymentByClaimToken(token);

  if (!pendingPayment) {
    return (
      <ClaimError
        title="Invalid Claim Link"
        message="This claim link is invalid or does not exist."
      />
    );
  }

  if (pendingPayment.status === 'claimed') {
    return (
      <ClaimError
        title="Already Claimed"
        message="This payment has already been claimed and transferred to your wallet."
        txHash={undefined} // TODO: Get txHash from payout record
      />
    );
  }

  // Check expiration (lazy expiration check - no cron job)
  if (new Date() > new Date(pendingPayment.claimExpiresAt)) {
    return (
      <ClaimError
        title="Claim Expired"
        message="This claim link has expired after 1 year. Please contact support for assistance."
      />
    );
  }

  // 2. Check authentication
  const session = await getSession();

  if (!session) {
    return <ClaimLoginPrompt pendingPayment={pendingPayment} returnUrl={`/claim/${token}`} />;
  }

  // 3. Verify GitHub identity matches (UX layer - early feedback)
  // Security enforcement also happens in API route (app/api/claim/[token]/route.ts:69-74)
  // Type assertion to access githubUserId (populated in lib/auth/auth.ts:117 during GitHub OAuth)
  const userGithubId = (session.user as { githubUserId?: bigint }).githubUserId;

  // GitHub ID verification: Prevents wrong users from seeing claim UI (better UX than 403 error)
  // Alternative rejected: Extending better-auth types (overkill for single use case)
  // Chosen approach: Type assertion (simple, follows existing pattern in API route)
  // Trade-off: Slight code duplication for better UX (shows error early vs after claim attempt)
  if (!userGithubId || userGithubId !== pendingPayment.recipientGithubUserId) {
    return (
      <ClaimGithubMismatch
        expectedUsername={pendingPayment.recipientGithubUsername}
        currentUsername={session.user.name || 'Unknown'}
        claimToken={token}
      />
    );
  }

  // 4. Check if user has wallet
  const wallet = await getUserWallet(session.user.id);

  if (!wallet?.tempoAddress) {
    return <CreateWalletForClaim pendingPayment={pendingPayment} claimToken={token} />;
  }

  // 5. User has wallet - ready to claim
  return (
    <ClaimPayment
      pendingPayment={pendingPayment}
      userWallet={{ tempoAddress: wallet.tempoAddress }}
    />
  );
}
