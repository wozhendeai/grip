import { TxDetail } from './_components/tx-detail';

interface TxPageProps {
  params: Promise<{ hash: string }>;
}

/**
 * Transaction detail page (public)
 *
 * Displays transaction details including amount, addresses, and memo.
 * Can also be shown as a modal via route interception.
 */
export default async function TxPage({ params }: TxPageProps) {
  const { hash } = await params;

  return <TxDetail hash={hash} />;
}
