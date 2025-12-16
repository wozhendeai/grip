import { AddressDisplay } from '@/components/tempo/address-display';
import { TokenAmount } from '@/components/tempo/token-amount';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPayoutByTxHash } from '@/db/queries';

interface TxDetailProps {
  hash: string;
}

/**
 * Transaction detail display component
 *
 * Shows:
 * - Status badge (confirmed/pending)
 * - Amount + token
 * - Recipient address
 * - Timestamp
 * - Memo (issue/PR/contributor)
 * - Link to explorer
 */
export async function TxDetail({ hash }: TxDetailProps) {
  const result = await getPayoutByTxHash(hash);

  if (!result) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-lg font-medium">Transaction not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No transaction with hash &quot;{hash.slice(0, 10)}...&quot; exists.
        </p>
      </div>
    );
  }

  const { payout, bounty, repoSettings, recipient } = result;

  // Build memo from payout fields
  const memoText = payout.memoContributor
    ? `${payout.memoContributor} #${payout.memoIssueNumber ?? ''}${payout.memoPrNumber ? ` PR#${payout.memoPrNumber}` : ''}`
    : payout.memoBytes32;

  const timestamp = payout.confirmedAt ?? payout.createdAt;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Transaction Details</h1>
        <Badge variant={payout.status === 'confirmed' ? 'default' : 'secondary'}>
          {payout.status === 'confirmed'
            ? 'Confirmed'
            : payout.status === 'pending'
              ? 'Pending'
              : payout.status}
        </Badge>
      </div>

      {/* Amount */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-normal text-muted-foreground">Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <TokenAmount amount={payout.amount.toString()} symbol="USDC" className="text-3xl" />
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-normal text-muted-foreground">Recipient</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {payout.recipientAddress && <AddressDisplay address={payout.recipientAddress} />}
            {recipient.name && (
              <span className="text-sm text-muted-foreground">({recipient.name})</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardContent className="space-y-4 p-4">
          {/* Type */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline">Payout</Badge>
          </div>

          {/* Timestamp */}
          {timestamp && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span>
                {new Date(timestamp).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {/* Hash */}
          {payout.txHash && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hash</span>
              <AddressDisplay address={payout.txHash} />
            </div>
          )}

          {/* Block Number */}
          {payout.blockNumber && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Block</span>
              <span>{Number(payout.blockNumber).toLocaleString()}</span>
            </div>
          )}

          {/* Memo */}
          {memoText && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Memo</span>
              <code className="rounded bg-muted px-2 py-1 text-xs">{memoText}</code>
            </div>
          )}

          {/* Linked Bounty */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bounty</span>
            <span className="text-right">
              {bounty.title.slice(0, 30)}
              {bounty.title.length > 30 ? '...' : ''}
            </span>
          </div>

          {/* Project */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Project</span>
            <code className="text-xs text-muted-foreground">{bounty.githubFullName}</code>
          </div>
        </CardContent>
      </Card>

      {/* Explorer Link */}
      {payout.txHash && (
        <a
          href={`https://explore.tempo.xyz/tx/${payout.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-primary hover:underline"
        >
          View on Tempo Explorer
        </a>
      )}
    </div>
  );
}
