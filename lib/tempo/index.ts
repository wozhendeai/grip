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
 */

export * from './constants';
export * from './balance';
export * from './payments';
export * from './signing';
