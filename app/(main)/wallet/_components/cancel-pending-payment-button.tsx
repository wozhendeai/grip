'use client';

import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';
import { cancelPendingPaymentAction } from '../_actions/cancel-pending-payment';

/**
 * Cancel Pending Payment Button
 *
 * Design Decision: Separate client component for interactivity
 * - Parent (PendingPaymentItem) can stay in server component
 * - Only this button needs client-side state (loading, confirmation)
 * - Follows Next.js pattern: minimize client components
 *
 * Pattern: Progressive enhancement with form action
 * - Without JS: Form submits to server action (page refresh)
 * - With JS: useTransition prevents navigation, shows loading state
 */
interface CancelPendingPaymentButtonProps {
  paymentId: string;
}

export function CancelPendingPaymentButton({ paymentId }: CancelPendingPaymentButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    // Native confirm dialog (matches existing pattern in codebase)
    const confirmed = confirm(
      'Cancel this pending payment?\n\nThe recipient will no longer be able to claim these funds.'
    );

    if (!confirmed) return;

    startTransition(async () => {
      setError(null);

      const result = await cancelPendingPaymentAction(formData);

      if (!result.success) {
        setError(result.error || 'Failed to cancel payment');
        // Error persists on screen - user can try again
      }
      // On success, revalidatePath in server action triggers re-render
      // Payment disappears from list automatically
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col items-end gap-1">
      <input type="hidden" name="paymentId" value={paymentId} />
      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        {isPending ? 'Cancelling...' : 'Cancel'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
