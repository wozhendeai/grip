'use client';

import { CreateWalletModal } from '@/components/tempo/create-wallet-modal';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { SendPaymentModal } from './send-payment-modal';

type SendPaymentActionProps = {
  recipientUsername: string;
  recipientName: string | null;
};

/**
 * SendPaymentAction Component
 *
 * Client component wrapper for the "Send Payment" button and modal.
 * Keeps the parent UserProfile component as a server component.
 *
 * UX Flow:
 * - Button always visible (good CTA for wallet onboarding)
 * - If user has no wallet → prompt wallet creation first
 * - After wallet creation → automatically open payment modal
 * - If user has wallet → directly open payment modal
 */
export function SendPaymentAction({ recipientUsername, recipientName }: SendPaymentActionProps) {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [createWalletModalOpen, setCreateWalletModalOpen] = useState(false);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);

  // Check if user has a wallet on mount
  useEffect(() => {
    async function checkWallet() {
      const res = await fetch('/api/auth/tempo/passkeys');
      const data = await res.json();
      const wallet = data.passkeys?.find((p: { tempoAddress?: string }) => p.tempoAddress);
      setHasWallet(!!wallet);
    }
    checkWallet();
  }, []);

  function handleClick() {
    if (hasWallet === false) {
      // No wallet - prompt creation first
      setCreateWalletModalOpen(true);
    } else {
      // Has wallet - show payment modal
      setPaymentModalOpen(true);
    }
  }

  function handleWalletCreated() {
    setHasWallet(true);
    setCreateWalletModalOpen(false);
    // Open payment modal after wallet creation
    setPaymentModalOpen(true);
  }

  return (
    <>
      <Button onClick={handleClick} size="sm" disabled={hasWallet === null}>
        Send Payment
      </Button>

      <CreateWalletModal
        open={createWalletModalOpen}
        onOpenChange={setCreateWalletModalOpen}
        onSuccess={handleWalletCreated}
        title="Create Wallet to Send Payment"
        description="You need a wallet to send payments. Create one now using your device biometrics - it only takes a few seconds."
      />

      <SendPaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        recipientUsername={recipientUsername}
        recipientName={recipientName}
      />
    </>
  );
}
