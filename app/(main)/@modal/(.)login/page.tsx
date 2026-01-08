import { RouteModal } from '@/components/layout/route-modal';
import { LoginForm } from '../../login/_components/login-form';
import { Suspense } from 'react';

/**
 * Login modal (intercepting route)
 *
 * Shows login form in a modal overlay when accessed via in-app navigation.
 * Direct navigation to /login loads the full page instead.
 */
export default function LoginModal() {
  return (
    <RouteModal title="Sign In">
      <div className="flex items-center justify-center p-8">
        <Suspense fallback={<div className="h-32 animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </RouteModal>
  );
}
