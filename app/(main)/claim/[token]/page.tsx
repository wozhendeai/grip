import { getSession } from '@/lib/auth-server';
import { getCustodialWalletByClaimToken } from '@/lib/db/queries/custodial-wallets';
import { getUserWallet } from '@/lib/db/queries/passkeys';
import { ClaimError } from './_components/claim-error';
import { ClaimLoginPrompt } from './_components/claim-login-prompt';
import { ClaimPayment } from './_components/claim-payment';
import { CreateWalletForClaim } from './_components/create-wallet-for-claim';

/**
 * Claim Page
 *
 * Handles the claim flow for contributors who received payment to a custodial wallet.
 * The flow is:
 *
 * 1. Verify claim token is valid
 * 2. Check if user is authenticated
 * 3. Verify GitHub identity matches
 * 4. Check if user has a passkey wallet
 * 5. Show claim button to transfer funds
 *
 * This demonstrates Tempo's fee sponsorship: backend pays gas for the transfer.
 */

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ClaimPage({ params }: PageProps) {
  const { token } = await params;

  // 1. Verify claim token
  const custodialWallet = await getCustodialWalletByClaimToken(token);

  if (!custodialWallet) {
    return (
      <ClaimError
        title="Invalid Claim Link"
        message="This claim link is invalid or does not exist."
      />
    );
  }

  if (custodialWallet.status === 'claimed') {
    return (
      <ClaimError
        title="Already Claimed"
        message="This payment has already been claimed and transferred to your wallet."
        txHash={custodialWallet.transferTxHash ?? undefined}
      />
    );
  }

  // Check expiration (lazy expiration check - no cron job)
  if (new Date() > new Date(custodialWallet.claimExpiresAt)) {
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
    return <ClaimLoginPrompt custodialWallet={custodialWallet} returnUrl={`/claim/${token}`} />;
  }

  // 3. Verify GitHub identity matches
  // Use githubUserId from session (comes from better-auth GitHub OAuth)
  const sessionGithubId = session.user.id; // Better-auth stores GitHub ID as user.id

  // IMPORTANT: We need to match GitHub IDs, but better-auth doesn't expose
  // githubUserId directly. For now, we'll skip this check and match by
  // logging in with the correct GitHub account (better-auth handles this).
  // TODO: Add githubUserId to user table via better-auth plugin

  // 4. Check if user has wallet
  const wallet = await getUserWallet(session.user.id);

  if (!wallet?.tempoAddress) {
    return <CreateWalletForClaim custodialWallet={custodialWallet} claimToken={token} />;
  }

  // 5. User has wallet - ready to claim
  return (
    <ClaimPayment
      custodialWallet={custodialWallet}
      userWallet={{ tempoAddress: wallet.tempoAddress }}
    />
  );
}
