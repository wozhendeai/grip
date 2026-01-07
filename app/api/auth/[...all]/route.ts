/**
 * better-auth catch-all handler for authentication endpoints.
 * Handles login, logout, session, passkey registration/verification, and organization APIs.
 */
import { auth } from '@/lib/auth/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import { type NextRequest, NextResponse } from 'next/server';

const { GET: originalGET, POST, DELETE } = toNextJsHandler(auth);

/**
 * Wrapped GET handler to enforce ES256 (P-256) for passkey registration.
 *
 * Problem: better-auth uses SimpleWebAuthn defaults which request algorithms:
 * [-8 (EdDSA), -7 (ES256), -257 (RS256)]. Chrome's virtual authenticator picks EdDSA,
 * but Tempo blockchain requires ES256 (P-256) for address derivation.
 *
 * Solution: Filter pubKeyCredParams to only include ES256 (alg: -7).
 */
async function GET(request: NextRequest) {
  const response = await originalGET(request);

  // Only modify passkey registration options
  if (!request.nextUrl.pathname.endsWith('/passkey/generate-register-options')) {
    return response;
  }

  try {
    const options = await response.json();

    // Filter pubKeyCredParams to only include ES256 (alg: -7)
    if (options.pubKeyCredParams) {
      options.pubKeyCredParams = options.pubKeyCredParams.filter(
        (param: { alg: number }) => param.alg === -7
      );

      // Ensure we have at least ES256
      if (options.pubKeyCredParams.length === 0) {
        options.pubKeyCredParams = [{ type: 'public-key', alg: -7 }];
      }
    }

    return NextResponse.json(options, {
      status: response.status,
      headers: response.headers,
    });
  } catch {
    // If parsing fails, return original response
    return response;
  }
}

export { GET, POST, DELETE };
