'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ClaimResultBannerProps {
  claimed?: boolean;
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: 'The claim link expired or was invalid. Please try again.',
  missing_state: 'Missing authentication state. Please try again.',
  repo_not_in_installation:
    'The repository was not included in the GitHub App installation. Please try again and select this repository.',
  repo_not_found: 'Repository not found on GitHub.',
  session_expired: 'Your session expired. Please log in again.',
  database_error: 'Failed to save repository settings. Please try again.',
  github_api_error: 'Failed to communicate with GitHub. Please try again.',
  installation_cancelled: 'GitHub App installation was cancelled.',
};

/**
 * Claim Result Banner
 *
 * Shows success or error message after the claim flow completes.
 * Auto-cleans the URL after displaying the message.
 */
export function ClaimResultBanner({ claimed, error }: ClaimResultBannerProps) {
  const router = useRouter();

  // Clean up URL after showing the message
  useEffect(() => {
    if (claimed || error) {
      const timer = setTimeout(() => {
        router.replace(window.location.pathname);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [claimed, error, router]);

  if (claimed) {
    return (
      <div className="mb-6 rounded-lg border border-success/30 bg-success/10 p-4">
        <p className="font-medium text-success">Repository claimed successfully!</p>
        <p className="mt-1 text-sm text-success/80">
          You now have full access to repository settings and webhook integration.
        </p>
      </div>
    );
  }

  if (error) {
    const message = ERROR_MESSAGES[error] || `An error occurred: ${error}`;
    return (
      <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <p className="font-medium text-destructive">Failed to claim repository</p>
        <p className="mt-1 text-sm text-destructive/80">{message}</p>
      </div>
    );
  }

  return null;
}
