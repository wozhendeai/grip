import type { AccessKey } from '@/lib/auth/tempo-plugin/types';
import { AccessKeyDetail } from '../access-key-detail';

export interface AccessKeyDetailContentProps {
  accessKey: AccessKey;
  keyWalletAddress?: `0x${string}`;
  rootWalletAddress?: `0x${string}`;
  variant?: 'page' | 'modal';
}

export function AccessKeyDetailContent({
  accessKey,
  keyWalletAddress,
  rootWalletAddress,
  variant = 'page',
}: AccessKeyDetailContentProps) {
  return (
    <AccessKeyDetail
      accessKey={accessKey}
      keyWalletAddress={keyWalletAddress}
      rootWalletAddress={rootWalletAddress}
      variant={variant}
    />
  );
}
