/**
 * Tempo blockchain utilities for BountyLane
 *
 * Tempo is a Layer-1 blockchain for stablecoin payments.
 *
 * Key concepts:
 * - TIP-20: ERC-20 extended with memos, commitments, and currency declarations
 * - Payment Lanes: Guaranteed blockspace for TIP-20 transfers
 * - Passkey Auth: WebAuthn/P256 native signing
 * - Fee Sponsorship: Apps can pay users' gas fees
 *
 * CRITICAL: Tempo has no native token!
 * - eth_getBalance returns a placeholder (NOT real balance)
 * - Always use getTIP20Balance() for balance checks
 *
 * NOTE: This barrel export prioritizes SDK-based utilities from client.ts.
 * Client components using WebAuthn signing should import from './signing' directly.
 */

export * from './constants';
export * from './client';
export * from './payments';

// signing.ts not exported by default - it contains legacy implementations
// that are being replaced by SDK. Client components can still import directly:
// import { signTempoTransaction } from '@/lib/tempo/signing'
