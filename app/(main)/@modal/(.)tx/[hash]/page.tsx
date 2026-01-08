import { RouteModal } from '@/components/layout/route-modal';
import { TxDetail } from '../../../tx/[hash]/_components/tx-detail';

interface TxModalPageProps {
  params: Promise<{ hash: string }>;
}

/**
 * Transaction detail modal (intercepted route)
 *
 * Shows transaction details in a modal when navigating within the app.
 * Direct URL access shows the full page instead.
 */
export default async function TxModalPage({ params }: TxModalPageProps) {
  const { hash } = await params;

  return (
    <RouteModal title="Transaction Details">
      <TxDetail hash={hash} />
    </RouteModal>
  );
}
