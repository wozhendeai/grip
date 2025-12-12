'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
 */
export function SendPaymentAction({ recipientUsername, recipientName }: SendPaymentActionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setModalOpen(true)} size="sm">
        Send Payment
      </Button>

      <SendPaymentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        recipientUsername={recipientUsername}
        recipientName={recipientName}
      />
    </>
  );
}
