'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowUpRight, Settings, Wallet as WalletIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { Hooks } from 'wagmi/tempo';
import { PasskeyManager } from '../../_components/passkey-manager';
import { FeeTokenSelect } from './fee-token-select';
import { FundContent } from './fund-content';
import { WithdrawContent } from './withdraw-content';

/**
 * Hook to get user's fee token preference
 *
 * Returns undefined if user hasn't set a fee token yet.
 * Callers should prompt user to set a fee token before showing balance.
 */
function useFeeToken(walletAddress: `0x${string}`) {
  const { data: userFeeToken, isLoading: isLoadingFeeToken } = Hooks.fee.useUserToken({
    account: walletAddress,
    query: { enabled: Boolean(walletAddress) },
  });

  const tokenAddress = userFeeToken?.address as `0x${string}` | undefined;

  const { data: metadata, isLoading: isLoadingMetadata } = Hooks.token.useGetMetadata({
    token: tokenAddress ?? '0x0000000000000000000000000000000000000000',
    query: {
      enabled: Boolean(tokenAddress),
      staleTime: 86_400_000,
    },
  });

  return {
    tokenAddress,
    symbol: metadata?.symbol,
    decimals: metadata?.decimals ?? 6,
    isLoading: isLoadingFeeToken || isLoadingMetadata,
    hasToken: Boolean(tokenAddress),
  };
}

export interface WalletHeroProps {
  wallet: {
    id: string;
    credentialID: string;
    name: string | null;
    tempoAddress: `0x${string}`;
    createdAt: string;
  };
  isModal?: boolean;
  onBalanceChange?: (balance: number) => void;
}

type ModalView = 'main' | 'fund' | 'withdraw' | 'settings';

export function WalletHero({ wallet, isModal = false, onBalanceChange }: WalletHeroProps) {
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<ModalView>('main');

  // Get user's fee token preference (undefined if not set)
  const {
    tokenAddress,
    symbol,
    decimals,
    isLoading: isLoadingToken,
    hasToken,
  } = useFeeToken(wallet.tempoAddress);

  // Only fetch balance if user has set a fee token
  const { data: rawBalance, isLoading: isLoadingBalance } = Hooks.token.useGetBalance({
    account: wallet.tempoAddress,
    token: tokenAddress ?? '0x0000000000000000000000000000000000000000',
    query: {
      enabled: Boolean(wallet?.tempoAddress) && hasToken,
      refetchInterval: 10_000,
      staleTime: 10_000,
    },
  });

  const balance = rawBalance ? Number(formatUnits(rawBalance, decimals)) : 0;
  const isLoading = isLoadingToken || (hasToken && isLoadingBalance);

  // Notify parent of balance changes
  useEffect(() => {
    if (rawBalance !== undefined) {
      onBalanceChange?.(balance);
    }
  }, [rawBalance, balance, onBalanceChange]);

  // Modal mode: inline fund/withdraw/settings views
  if (isModal) {
    if (modalView === 'fund') {
      return (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModalView('main')}
            className="mb-2 -ml-2"
          >
            ← Back
          </Button>
          <FundContent walletAddress={wallet.tempoAddress} />
        </div>
      );
    }

    if (modalView === 'withdraw') {
      return (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModalView('main')}
            className="mb-2 -ml-2"
          >
            ← Back
          </Button>
          <WithdrawContent
            balance={balance}
            tokenAddress={tokenAddress}
            decimals={decimals}
            tokenSymbol={symbol}
          />
        </div>
      );
    }

    if (modalView === 'settings') {
      return (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModalView('main')}
            className="mb-4 -ml-2"
          >
            ← Back
          </Button>
          <PasskeyManager wallet={wallet} />
        </div>
      );
    }

    // Main modal view - compact
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <BalanceSection
          balance={balance}
          isLoading={isLoading}
          walletAddress={wallet.tempoAddress}
          tokenSymbol={symbol}
          hasToken={hasToken}
        />
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => setModalView('fund')}>
            <WalletIcon className="h-4 w-4" />
            Fund
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setModalView('withdraw')}>
            <ArrowUpRight className="h-4 w-4" />
            Withdraw
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setModalView('settings')}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Full page mode - card wrapped
  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BalanceSection
              balance={balance}
              isLoading={isLoading}
              walletAddress={wallet.tempoAddress}
              tokenSymbol={symbol}
              hasToken={hasToken}
            />
            <div className="flex gap-2">
              <Button size="lg" className="gap-2" onClick={() => setFundModalOpen(true)}>
                <WalletIcon className="h-4 w-4" />
                Fund
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => setWithdrawModalOpen(true)}
              >
                <ArrowUpRight className="h-4 w-4" />
                Withdraw
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => setSettingsModalOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fund Modal */}
      <Dialog open={fundModalOpen} onOpenChange={setFundModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader className="sr-only">
            <DialogTitle>Fund Your Wallet</DialogTitle>
          </DialogHeader>
          <FundContent walletAddress={wallet.tempoAddress} />
        </DialogContent>
      </Dialog>

      {/* Withdraw Modal */}
      <Dialog open={withdrawModalOpen} onOpenChange={setWithdrawModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader className="sr-only">
            <DialogTitle>Withdraw Funds</DialogTitle>
          </DialogHeader>
          <WithdrawContent
            balance={balance}
            tokenAddress={tokenAddress}
            decimals={decimals}
            tokenSymbol={symbol}
            onDone={() => setWithdrawModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wallet Settings</DialogTitle>
            <DialogDescription>Manage your passkey and wallet security</DialogDescription>
          </DialogHeader>
          <PasskeyManager wallet={wallet} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BalanceSection({
  balance,
  isLoading,
  walletAddress,
  tokenSymbol,
  hasToken,
}: {
  balance: number;
  isLoading: boolean;
  walletAddress: `0x${string}`;
  tokenSymbol: string | undefined;
  hasToken: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">Balance</p>
      {hasToken ? (
        <div className="flex items-baseline gap-2">
          {isLoading ? (
            <span className="text-3xl font-bold text-muted-foreground animate-pulse">$---.--</span>
          ) : (
            <span className="text-3xl font-bold">${balance.toFixed(2)}</span>
          )}
          <span className="text-sm text-muted-foreground">{tokenSymbol}</span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select a fee token to view balance</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Address:</span>
        <AddressDisplay address={walletAddress} truncate />
      </div>
      <div className="mt-3">
        <FeeTokenSelect walletAddress={walletAddress} />
      </div>
    </div>
  );
}
