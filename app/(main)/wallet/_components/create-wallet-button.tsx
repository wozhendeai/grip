'use client';

import { Button } from '@/components/ui/button';
import { passkey } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * CreateWalletButton - Client component for wallet creation
 *
 * Small client component: Only handles passkey creation flow.
 * Shows error states and triggers page refresh on success.
 */

export function CreateWalletButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      await passkey.addPasskey({ name: 'BountyLane Wallet' });
      // Refresh the page to show the new wallet
      router.refresh();
    } catch {
      setError('Failed to create wallet. Make sure your device supports passkeys.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-destructive mb-4">{error}</div>}
      <Button onClick={handleCreate} disabled={isCreating}>
        {isCreating ? 'Creating Wallet...' : 'Create Wallet with Passkey'}
      </Button>
      <p className="text-sm text-muted-foreground">
        This will prompt you to create a passkey using TouchID, FaceID, or your device&apos;s
        authentication method.
      </p>
    </div>
  );
}
