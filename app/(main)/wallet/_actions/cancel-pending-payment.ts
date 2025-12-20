'use server';

import { cancelPendingPayment } from '@/db/queries/pending-payments';
import { requireAuth } from '@/lib/auth/auth-server';
import { revalidatePath } from 'next/cache';

/**
 * Cancel Pending Payment Server Action
 *
 * Design Decision: Server Action instead of API route
 * - Simpler architecture: direct function call from client component
 * - Better DX: TypeScript errors show in IDE, no fetch boilerplate
 * - Modern Next.js pattern: recommended approach for mutations
 * - Progressive enhancement: works as form action without JavaScript
 *
 * Trade-off: Server Actions require 'use server' directive and can't
 * return complex objects (must be serializable). This is fine since
 * we just need success/error status.
 */
export async function cancelPendingPaymentAction(formData: FormData) {
  try {
    // Authenticate
    const session = await requireAuth();

    // Extract payment ID from form
    const paymentId = formData.get('paymentId') as string;
    if (!paymentId) {
      return { success: false, error: 'Payment ID required' };
    }

    // Cancel payment (includes validation that user owns the payment)
    await cancelPendingPayment(paymentId, session.user.id);

    // Revalidate wallet page (triggers React Server Component refresh)
    // This re-fetches pending payments without full page reload
    revalidatePath('/wallet');

    return { success: true };
  } catch (error) {
    console.error('[cancel-pending-payment-action] Error:', error);

    if (error instanceof Error) {
      return {
        success: false,
        error:
          error.message === 'Payment not found or cannot be cancelled'
            ? 'Payment not found, already cancelled, or you do not have permission'
            : 'Failed to cancel payment',
      };
    }

    return { success: false, error: 'Failed to cancel payment' };
  }
}
