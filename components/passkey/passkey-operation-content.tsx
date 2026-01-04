'use client';

import type { PasskeyOperationError, PasskeyPhase } from '@/lib/webauthn';
import { CheckCircle, Loader2 } from 'lucide-react';
import type React from 'react';
import { PasskeyErrorContent } from './passkey-error-content';

export interface PasskeyOperationContentProps {
  // Operation state
  phase: PasskeyPhase;
  error: PasskeyOperationError | null;

  // Context for messaging
  operationType: 'signing' | 'registration';
  operationLabel?: string; // "Access Key", "Pending Payment", "Wallet", etc.

  // Actions
  onRetry?: () => void;
  onCreateWallet?: () => void;

  // Content customization
  children?: React.ReactNode; // Custom content for ready state
  successMessage?: string;
  educationalContent?: React.ReactNode;
}

/**
 * Headless passkey operation content component
 *
 * Renders UI for all passkey operation phases (ready, connecting, signing, registering, processing, success, error).
 * This is a pure content component - wrap it in Dialog, Sheet, or render inline.
 *
 * Parent component owns the library calls and state, content just renders based on props.
 *
 * @example Dialog usage
 * ```tsx
 * <Dialog open={open} onOpenChange={handleClose}>
 *   <DialogContent>
 *     <DialogHeader>
 *       <DialogTitle>{getPasskeyTitle(phase, error, 'signing', 'Access Key')}</DialogTitle>
 *     </DialogHeader>
 *     <PasskeyOperationContent
 *       phase={phase}
 *       error={error}
 *       operationType="signing"
 *       operationLabel="Access Key"
 *       onRetry={handleRetry}
 *     >
 *       {phase === 'ready' && <CustomReadyUI />}
 *     </PasskeyOperationContent>
 *   </DialogContent>
 * </Dialog>
 * ```
 *
 * @example Sheet usage
 * ```tsx
 * <Sheet open={open}>
 *   <SheetContent>
 *     <PasskeyOperationContent phase={phase} error={error} operationType="registration" />
 *   </SheetContent>
 * </Sheet>
 * ```
 */
export function PasskeyOperationContent({
  phase,
  error,
  operationType,
  operationLabel,
  onRetry,
  onCreateWallet,
  children,
  successMessage,
  educationalContent,
}: PasskeyOperationContentProps) {
  return (
    <div className="space-y-6">
      {/* Educational content (if provided, shown in ready state) */}
      {phase === 'ready' && educationalContent && educationalContent}

      {/* Ready state - render children */}
      {phase === 'ready' && children}

      {/* Connecting state (wagmi only) */}
      {phase === 'connecting' && (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="body-base font-medium">Connecting to wallet...</p>
            <p className="body-sm text-muted-foreground">This will only take a moment</p>
          </div>
        </div>
      )}

      {/* Signing state (wagmi only) */}
      {phase === 'signing' && (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="body-base font-medium">Waiting for passkey signature...</p>
            <p className="body-sm text-muted-foreground">
              Check your device for the passkey prompt
            </p>
          </div>
        </div>
      )}

      {/* Registering state (better-auth only) */}
      {phase === 'registering' && (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="body-base font-medium">Creating wallet...</p>
            <p className="body-sm text-muted-foreground">
              Complete the biometric prompt on your device
            </p>
          </div>
        </div>
      )}

      {/* Processing state */}
      {phase === 'processing' && (
        <div className="text-center py-12 space-y-4">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
          <div className="space-y-2">
            <p className="body-base font-medium">Processing...</p>
            <p className="body-sm text-muted-foreground">This will only take a moment</p>
          </div>
        </div>
      )}

      {/* Success state */}
      {phase === 'success' && (
        <div className="text-center py-12 space-y-4">
          <CheckCircle className="mx-auto h-12 w-12 text-primary" />
          <div className="space-y-2">
            <p className="body-base font-medium">
              {successMessage || `${operationLabel || 'Operation'} complete!`}
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && error && (
        <PasskeyErrorContent
          error={error}
          operationType={operationType}
          onRetry={onRetry}
          onCreateWallet={onCreateWallet}
        />
      )}
    </div>
  );
}

/**
 * Helper to generate dialog title based on phase and error
 *
 * Use this when wrapping PasskeyOperationContent in a Dialog to set the DialogTitle.
 *
 * @example
 * ```tsx
 * <DialogHeader>
 *   <DialogTitle>{getPasskeyTitle(phase, error, 'signing', 'Access Key')}</DialogTitle>
 * </DialogHeader>
 * ```
 */
export function getPasskeyTitle(
  phase: PasskeyPhase,
  error: PasskeyOperationError | null,
  operationType: 'signing' | 'registration',
  operationLabel?: string
): string {
  if (error) {
    if (error.type === 'wallet_not_found') return 'Wallet Not Found';
    if (error.type === 'user_rejected') {
      return operationType === 'signing' ? 'Signature Cancelled' : 'Creation Cancelled';
    }
    if (error.type === 'webauthn') return 'Passkey Error';
    return 'Something Went Wrong';
  }

  if (operationLabel) {
    if (phase === 'success') return `${operationLabel} Created`;
    return `Create ${operationLabel}`;
  }

  return operationType === 'signing' ? 'Sign with Passkey' : 'Create Wallet';
}
