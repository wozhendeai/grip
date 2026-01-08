'use client';

import { Button } from '@/components/ui/button';
import type { PasskeyOperationError } from '@/lib/webauthn';
import { AlertTriangle, Wallet } from 'lucide-react';
import Link from 'next/link';

interface PasskeyErrorContentProps {
  error: PasskeyOperationError;
  operationType: 'signing' | 'registration';
  onRetry?: () => void;
  onCreateWallet?: () => void;
}

/**
 * Reusable error UI for passkey operations
 * Handles all error types with appropriate messaging and actions
 */
export function PasskeyErrorContent({
  error,
  operationType,
  onRetry,
  onCreateWallet,
}: PasskeyErrorContentProps) {
  // wallet_not_found error (wagmi signing only)
  if (error.type === 'wallet_not_found') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="body-sm text-muted-foreground">
              We couldn't find your wallet's passkey on this device.
            </p>
            <p className="body-sm text-muted-foreground font-medium">Common causes:</p>
            <ul className="body-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>
                <strong>Different device:</strong> You're not using the device where you created
                your wallet
              </li>
              <li>
                <strong>Passkey deleted:</strong> Your browser's passkey was removed
              </li>
              <li>
                <strong>No wallet yet:</strong> You haven't created a wallet
              </li>
            </ul>
            <p className="body-sm text-muted-foreground mt-2">
              If you're on a different device, return to your original device. If you don't have a
              wallet yet, create one in Settings.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {onCreateWallet && (
            <Button onClick={onCreateWallet} className="flex-1">
              <Wallet className="mr-2 h-4 w-4" />
              Go to Wallet Settings
            </Button>
          )}
          {onRetry && (
            <Button onClick={onRetry} variant="outline" className="flex-1">
              Try Again
            </Button>
          )}
        </div>
      </div>
    );
  }

  // user_rejected error (cancellation)
  if (error.type === 'user_rejected') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/50 p-4">
          <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="body-sm text-muted-foreground">{error.message} Click below to try again.</p>
        </div>
        {onRetry && (
          <Button onClick={onRetry} className="w-full">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // webauthn error (device/browser issues)
  if (error.type === 'webauthn') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-muted bg-muted/50 p-4">
          <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="body-sm text-muted-foreground">{error.message}</p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <Button onClick={onRetry} className="flex-1">
              Try Again
            </Button>
          )}
          {operationType === 'signing' && (
            <Button
              nativeButton={false}
              variant="outline"
              className="flex-1"
              render={
                <Link href="/settings/wallet">
                  <Wallet className="mr-2 h-4 w-4" />
                  Wallet Settings
                </Link>
              }
            />
          )}
        </div>
      </div>
    );
  }

  // operation_failed or unknown error (generic fallback)
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <p className="body-sm text-muted-foreground">{error.message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} className="w-full">
          Try Again
        </Button>
      )}
    </div>
  );
}
