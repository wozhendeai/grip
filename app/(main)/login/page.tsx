import { Suspense } from 'react';
import { LoginForm } from './_components/login-form';

/**
 * Login page (full page view)
 *
 * Shows centered login form for direct navigation to /login.
 * When accessed via in-app navigation, the modal intercept is used instead.
 *
 * Note: Wrapped in a card-like container since LoginForm doesn't include one
 * (to avoid double-card effect in modals).
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <div className="rounded-lg border border-border bg-card p-8 shadow-xs">
        <Suspense fallback={<div className="h-32 animate-pulse" />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
