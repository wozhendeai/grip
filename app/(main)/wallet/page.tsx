import { redirect } from 'next/navigation';

/**
 * Wallet page redirect
 *
 * The wallet functionality has moved to /settings/wallet.
 * This redirect ensures old links still work.
 */
export default function WalletPage() {
  redirect('/settings/wallet');
}
