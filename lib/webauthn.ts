/**
 * WebAuthn Error Classification Utilities
 *
 * Pure functions for classifying WebAuthn errors from both wagmi and better-auth.
 * Works with browser WebAuthn errors (NotAllowedError, etc.) regardless of library.
 */

import { BaseError, UserRejectedRequestError } from 'viem';

/**
 * WebAuthn operation types shared across wagmi and better-auth
 */

/**
 * Standardized error type for WebAuthn operations
 * Works for both wagmi signing and better-auth registration
 */
export type PasskeyOperationError = {
  /** High-level error category */
  type: 'wallet_not_found' | 'user_rejected' | 'webauthn' | 'operation_failed' | 'unknown';

  /** User-facing error message */
  message: string;

  /** Which phase the error occurred in */
  phase: 'connect' | 'sign' | 'register' | 'process';

  /** Specific WebAuthn error classification (if applicable) */
  webAuthnErrorType?:
    | 'timeout_or_cancelled'
    | 'not_allowed'
    | 'credential_not_found'
    | 'not_supported';
};

/**
 * Phase of passkey operation
 * Used by both signing (wagmi) and registration (better-auth) flows
 */
export type PasskeyPhase =
  | 'ready' // Initial state, waiting for user action
  | 'connecting' // wagmi only: connecting to webAuthn connector
  | 'signing' // wagmi only: signing message with passkey
  | 'registering' // better-auth only: creating new passkey
  | 'processing' // Post-operation processing (API calls, etc.)
  | 'success' // Operation completed successfully
  | 'error'; // Operation failed

/**
 * Walk error chain to find root cause
 * Works for both viem BaseError (wagmi) and standard Error (better-auth)
 */
export function getRootCause(error: Error): Error {
  if (error instanceof BaseError) {
    return error.walk() ?? error;
  }

  // Walk cause chain for non-BaseError
  let current: Error = error;
  while (current.cause instanceof Error) {
    current = current.cause;
  }
  return current;
}

/**
 * Check if error is user rejection
 * Works for both wagmi (UserRejectedRequestError) and better-auth (generic cancellation)
 */
export function isUserRejectedError(error: Error | null): boolean {
  if (!error) return false;

  // Check error name directly
  if (error.name === 'UserRejectedRequestError') return true;

  // Walk the error chain for nested UserRejectedRequestError
  if (error instanceof BaseError) {
    const userRejectedError = error.walk((e) => e instanceof UserRejectedRequestError);
    if (userRejectedError) return true;
  }

  return false;
}

/**
 * Check if error is "wallet not found" (wagmi-specific)
 * Occurs when trying to sign without a passkey in the KeyManager
 */
export function isWalletNotFoundError(error: Error | null): boolean {
  if (!error) return false;

  const rootCause = getRootCause(error);
  return rootCause.message?.includes('publicKey not found') ?? false;
}

/**
 * WebAuthn-specific error types (browser errors)
 */
type WebAuthnErrorType =
  | 'timeout_or_cancelled'
  | 'not_allowed'
  | 'credential_not_found'
  | 'not_supported'
  | null;

/**
 * Classify WebAuthn-specific errors
 * These are browser-level errors, not library-specific
 */
export function getWebAuthnErrorType(error: Error | null): WebAuthnErrorType {
  if (!error) return null;

  const rootCause = getRootCause(error);
  const message = rootCause.message?.toLowerCase() ?? '';
  const name = rootCause.name;

  // NotAllowedError: user cancelled, timeout, or operation not permitted
  if (name === 'NotAllowedError' || message.includes('not allowed')) {
    if (message.includes('timed out') || message.includes('timeout')) {
      return 'timeout_or_cancelled';
    }
    return 'not_allowed';
  }

  // InvalidStateError: credential doesn't exist
  if (name === 'InvalidStateError' || message.includes('credential not found')) {
    return 'credential_not_found';
  }

  // NotSupportedError: browser/device doesn't support WebAuthn
  if (name === 'NotSupportedError' || message.includes('not supported')) {
    return 'not_supported';
  }

  // Check for the specific error pattern from the question
  if (message.includes('operation either timed out or was not allowed')) {
    return 'timeout_or_cancelled';
  }

  return null;
}

/**
 * Get user-facing message for WebAuthn error
 *
 * @param errorType - Classified WebAuthn error type
 * @param context - 'signing' or 'registration' for context-specific messaging
 */
export function getWebAuthnErrorMessage(
  errorType: WebAuthnErrorType,
  context: 'signing' | 'registration'
): string {
  switch (errorType) {
    case 'timeout_or_cancelled':
      return context === 'signing'
        ? 'The passkey request was cancelled or timed out. Please try again and complete the prompt when it appears.'
        : 'Wallet creation was cancelled or timed out. Please try again and complete the biometric prompt when it appears.';

    case 'not_allowed':
      return context === 'signing'
        ? "The passkey request was not allowed. Make sure you're using the same browser and device where you created your wallet."
        : 'Passkey creation was not allowed by your browser. Make sure you allow passkey creation when prompted.';

    case 'credential_not_found':
      return context === 'signing'
        ? "This passkey wasn't found on your device. You may need to use the device where you originally created your wallet."
        : 'No existing credential found on this device.';

    case 'not_supported':
      return "Passkeys aren't supported on this browser or device. Please try using a modern browser like Chrome, Safari, or Edge.";

    default:
      return context === 'signing'
        ? 'Something went wrong with the passkey request.'
        : 'Failed to create wallet. Please try again.';
  }
}

/**
 * Main classification function - converts any error to standardized PasskeyOperationError
 *
 * Use this function in try/catch blocks for both wagmi and better-auth operations.
 *
 * @param error - Raw error from wagmi or better-auth
 * @param phase - Which phase the error occurred in
 * @param context - 'signing' or 'registration' for context-specific messaging (auto-detected from phase if not provided)
 *
 * @example
 * ```typescript
 * try {
 *   await signMessage.mutateAsync({ message: { raw: hash } });
 * } catch (err) {
 *   const error = classifyWebAuthnError(err, 'sign');
 *   setError(error);
 * }
 * ```
 */
export function classifyWebAuthnError(
  error: unknown,
  phase: 'connect' | 'sign' | 'register' | 'process',
  context: 'signing' | 'registration' = phase === 'register' ? 'registration' : 'signing'
): PasskeyOperationError {
  if (!(error instanceof Error)) {
    return {
      type: 'unknown',
      message: 'An unexpected error occurred',
      phase,
    };
  }

  // Check for wallet not found (wagmi-specific, connect phase)
  if (isWalletNotFoundError(error)) {
    return {
      type: 'wallet_not_found',
      message: "We couldn't connect to your wallet.",
      phase: 'connect',
    };
  }

  // Check for user rejection
  if (isUserRejectedError(error)) {
    return {
      type: 'user_rejected',
      message:
        context === 'signing'
          ? 'The passkey prompt was cancelled.'
          : 'Wallet creation was cancelled.',
      phase,
    };
  }

  // Check for specific WebAuthn errors
  const webAuthnErrorType = getWebAuthnErrorType(error);
  if (webAuthnErrorType) {
    return {
      type: 'webauthn',
      message: getWebAuthnErrorMessage(webAuthnErrorType, context),
      phase,
      webAuthnErrorType,
    };
  }

  // Generic fallback
  return {
    type: 'unknown',
    message: error.message || 'An unexpected error occurred',
    phase,
  };
}
