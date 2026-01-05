import { redirect } from 'next/navigation';

/**
 * Wallet swap redirect
 *
 * The wallet functionality has moved to /settings/wallet.
 * This redirect ensures old links still work.
 */
export default function WalletSwapRedirect() {
  redirect('/settings/wallet/swap');
}
