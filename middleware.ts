import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Auth middleware for optimistic redirects
 *
 * Uses better-auth's getSessionCookie for cookie-based checks.
 * Note: This only checks cookie existence, not validity.
 * Actual session validation happens in RequireAuth components.
 */

// Routes only for unauthenticated users
const authRoutes = ['/login'];
// Routes that require authentication
const protectedRoutes = ['/wallet'];

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const path = request.nextUrl.pathname;

  // Redirect logged-in users away from auth pages to explore page
  if (sessionCookie && authRoutes.some((route) => path.startsWith(route))) {
    return NextResponse.redirect(new URL('/explore', request.url));
  }

  // Redirect unauthenticated users to login
  if (!sessionCookie && protectedRoutes.some((route) => path.startsWith(route))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/wallet/:path*', '/login'],
};
