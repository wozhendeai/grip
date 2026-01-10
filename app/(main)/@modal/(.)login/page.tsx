import { RouteModal } from '@/components/layout/route-modal';
import { LoginForm } from '../../login/_components/login-form';
import { Suspense } from 'react';

/**
 * Login modal (intercepting route)
 *
 * Shows login form in a modal overlay when accessed via in-app navigation.
 * Direct navigation to /login loads the full page instead.
 *
 * Close behavior uses router.replace() to a deterministic target:
 * 1. Checks `from` search param (e.g., /login?from=/dashboard)
 * 2. Falls back to "/" if no from param
 *
 * This prevents redirect loops when user was redirected from a protected route.
 */
export default function LoginModal() {
  // RouteModal uses useSearchParams, so entire tree needs Suspense
  return (
    <Suspense fallback={null}>
      <RouteModal title="Sign In">
        <div className="flex items-center justify-center p-8">
          <LoginForm />
        </div>
      </RouteModal>
    </Suspense>
  );
}
