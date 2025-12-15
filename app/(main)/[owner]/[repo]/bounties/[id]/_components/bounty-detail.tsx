'use client';

import { CreateWalletModal } from '@/components/auth/create-wallet-modal';
import { BountyStatus } from '@/components/bounty/bounty-status';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { UserAvatar } from '@/components/user/user-avatar';
import { getExplorerTxUrl } from '@/lib/tempo/constants';
import type { Bounty } from '@/lib/types';
import { CheckCircle, ExternalLink, GitPullRequest, Github } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ClaimSelectionModal } from './claim-selection-modal';
import { PaymentModal } from './payment-modal';

interface TreasuryCredentials {
  credentialId: string;
  address: string;
}

interface PayoutData {
  id: string;
  amount: number;
  tokenAddress: string;
  recipientAddress: string;
  memo: string;
}

interface TxParams {
  to: string;
  data: string;
  value: string;
}

interface ClaimantInfo {
  id: string;
  name: string | null;
  address: string;
}

interface BountyDetailProps {
  bounty: Bounty;
  canApprove?: boolean;
  treasuryCredentials?: TreasuryCredentials | null;
}

export function BountyDetail({
  bounty,
  canApprove = false,
  treasuryCredentials,
}: BountyDetailProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Claim state
  const [claimLoading, setClaimLoading] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Claim selection state
  const [showClaimSelection, setShowClaimSelection] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payoutData, setPayoutData] = useState<PayoutData | null>(null);
  const [txParams, setTxParams] = useState<TxParams | null>(null);
  const [claimantInfo, setClaimantInfo] = useState<ClaimantInfo | null>(null);

  // Auto-signing success state
  const [autoSignSuccess, setAutoSignSuccess] = useState(false);
  const [autoSignTxHash, setAutoSignTxHash] = useState<string | null>(null);

  const handleClaim = async () => {
    setClaimLoading(true);
    setClaimError(null);

    try {
      const res = await fetch(`/api/bounties/${bounty.id}/submit`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.error === 'WALLET_REQUIRED') {
        setShowWalletModal(true);
      } else if (res.ok) {
        window.location.reload(); // Refresh to show submission
      } else {
        setClaimError(data.error || 'Failed to submit for bounty');
      }
    } catch (error) {
      setClaimError('Failed to submit for bounty');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleApprove = async () => {
    const activeSubmissions =
      bounty.submissions?.filter((c) => c.status === 'pending' || c.status === 'approved') ?? [];

    // If multiple submissions, need to select which one to approve
    if (activeSubmissions.length > 1) {
      // Show manual selection UI
      setShowClaimSelection(true);
      return;
    }

    // Single submission - proceed as normal
    await approveWithClaim(activeSubmissions[0]?.id);
  };

  const approveWithClaim = async (claimId?: string) => {
    setIsApproving(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/bounties/${bounty.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve');
      }

      // Check if payment was auto-signed with Access Key
      if (data.autoSigned && data.txHash) {
        // SUCCESS: Access Key auto-signed the payout
        setAutoSignSuccess(true);
        setAutoSignTxHash(data.txHash);

        // Refresh page after showing success message
        setTimeout(() => {
          router.refresh();
        }, 3000);
      } else if (treasuryCredentials && data.payout && data.txParams && data.claimant) {
        // FALLBACK: Manual signing required (no Access Key or Access Key failed)
        setPayoutData(data.payout);
        setTxParams(data.txParams);
        setClaimantInfo(data.claimant);
        setShowPaymentModal(true);
      } else if (!treasuryCredentials) {
        // No treasury set up - show error
        setActionError('Treasury wallet not configured. Please set up a treasury passkey first.');
      } else {
        // Fallback - reload page
        window.location.reload();
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to approve');
    } finally {
      setIsApproving(false);
    }
  };

  const handlePaymentSuccess = (txHash: string) => {
    // Payment successful - reload page to show updated status
    console.log('Payment sent:', txHash);
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) {
      setActionError('Please provide a rejection reason');
      return;
    }
    setIsRejecting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bounties/${bounty.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: rejectNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject');
      }
      // Rejection successful - reload to show bounty back in open state
      window.location.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to reject');
    } finally {
      setIsRejecting(false);
    }
  };

  const isPaid = bounty.status === 'completed';
  const canShowApprovalActions = canApprove && bounty.status === 'open';
  const labels = bounty.labels ?? [];
  const activeSubmission = bounty.submissions?.find(
    (c) => c.status === 'pending' || c.status === 'approved' || c.status === 'merged'
  );

  return (
    <div className="min-h-screen">
      {/* Hero Section with Amount */}
      <section className="border-b border-border bg-card/30">
        <div className="container py-12">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm">
            <Link
              href="/explore"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Bounties
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href={`/${bounty.project.githubOwner}/${bounty.project.githubRepo}`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {bounty.project.githubFullName}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">#{bounty.githubIssueNumber}</span>
          </div>

          {/* Status + Issue Number */}
          <div className="mb-4 flex items-center gap-3">
            <BountyStatus status={bounty.status} />
            <a
              href={bounty.githubIssueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Issue #{bounty.githubIssueNumber}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Title */}
          <h1 className="mb-6 text-2xl font-bold md:text-3xl lg:text-4xl">{bounty.title}</h1>

          {/* Amount + Claimant Row */}
          <div className="flex flex-wrap items-start gap-6">
            {/* Amount box - shows PAID state clearly */}
            <div
              className={`rounded-lg border px-6 py-4 ${
                isPaid ? 'border-muted-foreground/30 bg-muted/30' : 'border-border bg-card'
              }`}
            >
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Bounty Amount
              </p>
              {isPaid ? (
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-muted-foreground line-through md:text-4xl">
                    ${bounty.totalFunded.toLocaleString()}
                  </span>
                  <span className="rounded bg-muted-foreground/20 px-2 py-1 text-sm font-medium text-muted-foreground">
                    PAID
                  </span>
                </div>
              ) : (
                <>
                  <span className="text-3xl font-bold md:text-4xl">
                    ${bounty.totalFunded.toLocaleString()}
                  </span>
                  <span className="ml-2 text-lg text-muted-foreground">USDC</span>
                </>
              )}
            </div>

            {/* Submitter - shown if bounty is claimed */}
            {activeSubmission && (
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                  {isPaid ? 'Completed by' : 'Claimed by'}
                </p>
                <div className="flex items-center gap-3">
                  {activeSubmission.submitter.image ? (
                    <img
                      src={activeSubmission.submitter.image}
                      alt={activeSubmission.submitter.name ?? 'Submitter'}
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {(activeSubmission.submitter.name ?? 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{activeSubmission.submitter.name ?? 'Unknown'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Multiple Active Submissions */}
          {bounty.submissions && bounty.submissions.length > 1 && (
            <div className="mt-6">
              <div className="rounded-lg border border-border bg-card px-6 py-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Submissions ({bounty.submissions.length})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Multiple contributors working on this bounty
                  </p>
                </div>

                <div className="space-y-3">
                  {bounty.submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between rounded-md border border-border/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={{
                            name: submission.submitter.name,
                            image: submission.submitter.image,
                          }}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-medium">{submission.submitter.name}</p>
                          {submission.githubPrUrl && (
                            <a
                              href={submission.githubPrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              PR #{submission.githubPrNumber}
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
                          {submission.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Labels */}
          {labels.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {labels.map((label) => (
                <span
                  key={label.name}
                  className="inline-flex items-center rounded bg-secondary px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <section className="container py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Description */}
          <div className="lg:col-span-2 space-y-6">
            {/* Issue Description */}
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">Issue Description</h2>
              <div className="prose prose-sm prose-invert max-w-none">
                {bounty.body ? (
                  bounty.body.split('\n').map((line, i) => {
                    const key = `line-${i}-${line.slice(0, 20)}`;
                    if (line.startsWith('## ')) {
                      return (
                        <h2
                          key={key}
                          className="mt-6 mb-3 text-lg font-semibold text-foreground first:mt-0"
                        >
                          {line.slice(3)}
                        </h2>
                      );
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <li key={key} className="ml-4 text-muted-foreground">
                          {line.slice(2)}
                        </li>
                      );
                    }
                    if (line.trim() === '') {
                      return <br key={key} />;
                    }
                    return (
                      <p key={key} className="text-muted-foreground">
                        {line}
                      </p>
                    );
                  })
                ) : (
                  <p className="text-muted-foreground italic">No description provided</p>
                )}
              </div>
            </div>

            {/* PR Link */}
            {activeSubmission?.githubPrUrl && (
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="mb-4 text-sm font-medium text-muted-foreground">Pull Request</h2>
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <GitPullRequest className="h-5 w-5" />
                  </div>
                  <div>
                    <a
                      href={activeSubmission.githubPrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-muted-foreground transition-colors"
                    >
                      Pull Request #{activeSubmission.githubPrNumber}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {bounty.status === 'open' ? 'Awaiting review' : 'Merged'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="rounded-lg border border-border bg-card p-6">
              {bounty.status === 'open' &&
              activeSubmission &&
              activeSubmission.status === 'pending' ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-warning">Work Submitted</p>
                  <p className="mt-1 text-xs text-muted-foreground">Awaiting review</p>
                </div>
              ) : bounty.status === 'open' &&
                activeSubmission &&
                activeSubmission.status === 'approved' ? (
                canShowApprovalActions ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-blue-400 text-center">
                      Ready for Approval
                    </p>
                    <p className="text-xs text-muted-foreground text-center mb-4">
                      PR submitted. Review and approve to release payment.
                    </p>

                    {actionError && (
                      <div className="p-2 rounded bg-destructive/10 text-destructive text-xs mb-3">
                        {actionError}
                      </div>
                    )}

                    {showRejectDialog ? (
                      <div className="space-y-3">
                        <textarea
                          className="w-full rounded border border-border bg-background p-2 text-sm"
                          placeholder="Rejection reason (required)..."
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          rows={3}
                        />
                        <ButtonGroup className="w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setShowRejectDialog(false);
                              setRejectNote('');
                              setActionError(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <ButtonGroupSeparator />
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={handleReject}
                            disabled={isRejecting}
                          >
                            {isRejecting ? 'Rejecting...' : 'Confirm Reject'}
                          </Button>
                        </ButtonGroup>
                      </div>
                    ) : (
                      <ButtonGroup className="w-full">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setShowRejectDialog(true)}
                          disabled={isApproving}
                        >
                          Reject
                        </Button>
                        <ButtonGroupSeparator />
                        <Button className="flex-1" onClick={handleApprove} disabled={isApproving}>
                          {isApproving ? 'Approving...' : 'Approve & Pay'}
                        </Button>
                      </ButtonGroup>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-blue-400">Under Review</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PR submitted, awaiting approval
                    </p>
                  </div>
                )
              ) : bounty.status === 'open' ? (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleClaim}
                    disabled={claimLoading}
                  >
                    {claimLoading ? 'Claiming...' : 'Claim Bounty'}
                  </Button>
                  {claimError && (
                    <p className="mt-2 text-center text-xs text-destructive">{claimError}</p>
                  )}
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Requires GitHub sign-in
                  </p>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-success">Bounty Complete</p>
                  <p className="mt-1 text-xs text-muted-foreground">Payment processed</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  render={(props) => (
                    <a
                      {...props}
                      href={bounty.githubIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )}
                >
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </Button>
              </div>
            </div>

            {/* Payment Info - shown when bounty is paid */}
            {isPaid && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-6">
                <h2 className="mb-4 text-sm font-medium text-success">Payment Complete</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-success">Paid</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">${bounty.totalFunded.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Wallet Creation Modal */}
      <CreateWalletModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
        title="Create Wallet to Claim"
        description="You need a wallet to receive bounty payments. Create one using your device's biometric authentication."
        onSuccess={() => {
          setShowWalletModal(false);
          handleClaim(); // Retry claim with new wallet
        }}
      />

      {/* Submission Selection Modal */}
      <ClaimSelectionModal
        open={showClaimSelection}
        onOpenChange={setShowClaimSelection}
        submissions={
          bounty.submissions?.filter((c) => c.status === 'pending' || c.status === 'approved') ?? []
        }
        completedByUserId={null}
        onSelect={approveWithClaim}
      />

      {/* Payment Modal */}
      {treasuryCredentials && payoutData && txParams && claimantInfo && (
        <PaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          payout={payoutData}
          txParams={txParams}
          claimant={claimantInfo}
          treasuryCredentialId={treasuryCredentials.credentialId}
          treasuryAddress={treasuryCredentials.address}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Auto-Signing Success Notification */}
      {autoSignSuccess && autoSignTxHash && (
        <div className="fixed bottom-8 right-8 max-w-md animate-in slide-in-from-bottom-5 fade-in">
          <div className="bg-card border border-primary/20 rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-2">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="heading-4 text-primary">Payment Sent Automatically!</h3>
                <p className="body-sm text-muted-foreground">
                  Your Access Key was used to sign and broadcast the payout transaction
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="caption text-muted-foreground font-mono">
                    {autoSignTxHash.slice(0, 10)}...{autoSignTxHash.slice(-8)}
                  </span>
                  <a
                    href={getExplorerTxUrl(autoSignTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
