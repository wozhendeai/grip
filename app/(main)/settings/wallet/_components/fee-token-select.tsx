'use client';

import { TokenSelect, type Token } from '@/components/tempo/token-select';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { getAddress } from 'viem';
import { useConnect, useConnections, useConnectors, useWaitForTransactionReceipt } from 'wagmi';
import { Hooks } from 'wagmi/tempo';

interface FeeTokenSelectProps {
  walletAddress: `0x${string}`;
}

/**
 * Fee token selector with signing capability
 *
 * Wraps TokenSelect with the connect + sign flow needed to set
 * the user's preferred fee token on Tempo.
 */
export function FeeTokenSelect({ walletAddress }: FeeTokenSelectProps) {
  const connectors = useConnectors();
  const connections = useConnections();
  const { mutateAsync: connectAsync } = useConnect();

  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch current fee token preference
  const { data: userFeeToken, isLoading: isLoadingFeeToken } = Hooks.fee.useUserToken({
    account: walletAddress,
    query: { enabled: Boolean(walletAddress) },
  });

  // Mutation to set fee token
  const {
    mutateAsync: setFeeToken,
    isPending: isSettingFeeToken,
    data: txHash,
  } = Hooks.fee.useSetUserToken();

  // Wait for transaction confirmation
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSelect = async (token: Token) => {
    try {
      // Connect if not already connected (required for signing)
      if (connections.length === 0) {
        setIsConnecting(true);
        const webAuthnConnector = connectors.find(
          (c) => c.id === 'webAuthn' || c.type === 'webAuthn'
        );

        if (!webAuthnConnector) {
          throw new Error('WebAuthn connector not available');
        }

        await connectAsync({ connector: webAuthnConnector });
        setIsConnecting(false);
      }

      const tokenAddress = getAddress(token.address);
      await setFeeToken({ token: tokenAddress });
    } catch (err) {
      setIsConnecting(false);
      console.error('Failed to set fee token:', err);
    }
  };

  const isBusy = isConnecting || isSettingFeeToken || isConfirming;

  if (isLoadingFeeToken) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>Loading fee token...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <TokenSelect
        value={userFeeToken?.address as `0x${string}` | undefined}
        onSelect={handleSelect}
        walletAddress={walletAddress}
        showBalances
        placeholder="Not set"
        disabled={isBusy}
        label="Fee token:"
      />
      {isBusy && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
    </div>
  );
}
