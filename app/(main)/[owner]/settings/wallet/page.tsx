import { getOrgWalletAddress } from '@/db/queries/organizations';
import { auth } from '@/lib/auth/auth';
import { getSession } from '@/lib/auth/auth-server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { WalletContent } from '../_components/wallet-content';
import type { OrgRole } from '../_lib/types';

interface WalletPageProps {
  params: Promise<{ owner: string }>;
}

/**
 * Organization settings - Wallet page
 *
 * Route: /[org-slug]/settings/wallet
 *
 * Accessible to: owner, billingAdmin
 */
export default async function WalletPage({ params }: WalletPageProps) {
  const { owner } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/${owner}/settings/wallet`);
  }

  const headersList = await headers();
  const result = await auth.api.getFullOrganization({
    headers: headersList,
    query: { organizationSlug: owner },
  });

  if (!result) {
    notFound();
  }

  const membership = result.members.find((m) => m.userId === session.user.id);
  if (!membership) {
    notFound();
  }

  const currentUserRole = membership.role as OrgRole;
  const canViewWallet = currentUserRole === 'owner' || currentUserRole === 'billingAdmin';

  if (!canViewWallet) {
    redirect(`/${owner}/settings`);
  }

  const walletAddress = await getOrgWalletAddress(result.id).catch(() => null);

  return <WalletContent walletAddress={walletAddress} />;
}
