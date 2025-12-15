'use client';

import { Button } from '@/components/ui/button';
import { ArrowUpRight, Wallet as WalletIcon } from 'lucide-react';
import { useState } from 'react';
import { FundModal } from './fund-modal';
import { WithdrawModal } from './withdraw-modal';

/**
 * WalletActions - Client component for fund/withdraw buttons
 *
 * Small client component: Only handles modal state and triggers.
 * Parent passes wallet address and balance.
 */

interface WalletActionsProps {
  walletAddress: string;
  balance: number;
}

export function WalletActions({ walletAddress, balance }: WalletActionsProps) {
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  return (
    <>
      <div className="flex gap-4">
        <Button size="lg" className="gap-2" onClick={() => setFundModalOpen(true)}>
          <WalletIcon className="h-4 w-4" />
          Fund Account
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="gap-2"
          onClick={() => setWithdrawModalOpen(true)}
        >
          <ArrowUpRight className="h-4 w-4" />
          Withdraw
        </Button>
      </div>

      <FundModal
        open={fundModalOpen}
        onOpenChange={setFundModalOpen}
        walletAddress={walletAddress}
      />
      <WithdrawModal
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        balance={balance}
      />
    </>
  );
}
