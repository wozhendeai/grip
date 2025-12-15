'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { signIn, useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Login form component
 *
 * Shared between full page and modal views.
 * Supports GitHub OAuth and Passkey authentication.
 *
 * Note: No Card wrapper - the parent context (DialogContent or page container)
 * provides the card-like styling to avoid double-card effect in modals.
 */
export function LoginForm() {
  const router = useRouter();
  const { isPending } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn.social({
        provider: 'github',
        callbackURL: '/explore',
      });
    } catch (err) {
      setError('Failed to sign in with GitHub');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn.passkey();
      if (result.error) {
        throw new Error(result.error.message);
      }
      router.push('/explore');
    } catch (err) {
      setError('Failed to sign in with passkey');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Sign in to BountyLane</h2>
        <p className="text-sm text-muted-foreground">Connect with GitHub to get started</p>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
        )}

        <Button className="w-full" onClick={handleGitHubSignIn} disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Continue with GitHub'}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handlePasskeySignIn}
          disabled={isLoading}
        >
          Sign in with Passkey
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Passkeys use your device&apos;s biometrics (TouchID/FaceID) for secure authentication.
        </p>
      </div>
    </div>
  );
}
