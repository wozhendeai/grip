'use client';

import { AddressDisplay } from '@/components/tempo/address-display';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowUpRight,
  Check,
  Copy,
  Droplet,
  ExternalLink,
  Settings,
  Wallet as WalletIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useState } from 'react';
import { PasskeyManager } from '../passkey-manager';

/**
 * WalletContent - Unified wallet management for settings
 *
 * Layout: Balance + action buttons at top, tabs below for content.
 * Adapts behavior based on isModal prop:
 * - Modal: Fund/withdraw show inline in modal (replaces content)
 * - Full page: Fund/withdraw open dialog modals
 */

export interface WalletContentProps {
  wallet: {
    id: string;
    name: string | null;
    tempoAddress: string | null;
    createdAt: string;
  } | null;
  isModal?: boolean;
}

type ActivityTab = 'all' | 'earnings' | 'sent';
type ModalView = 'main' | 'fund' | 'withdraw' | 'settings';

export function WalletContent({ wallet, isModal = false }: WalletContentProps) {
  const [balance, setBalance] = useState<number>(0.0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [activeTab, setActiveTab] = useState<ActivityTab>('all');
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [modalView, setModalView] = useState<ModalView>('main');

  const fetchBalance = useCallback(async () => {
    if (!wallet?.tempoAddress) return;
    try {
      const res = await fetch(`/api/wallet/balance?address=${wallet.tempoAddress}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(Number.parseFloat(data.formattedBalance ?? '0'));
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [wallet?.tempoAddress]);

  useEffect(() => {
    if (wallet?.tempoAddress) {
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchBalance, wallet?.tempoAddress]);

  // No wallet - show passkey creation
  if (!wallet?.tempoAddress) {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">Manage your Tempo wallet and passkey settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create Your Wallet</CardTitle>
            <CardDescription>
              Your wallet is secured by a passkey (TouchID, FaceID, or security key)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasskeyManager wallet={wallet} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Modal mode with inline fund/withdraw/settings views
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
          <WithdrawContent balance={balance} />
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

    // Main modal view
    return (
      <div className="space-y-4">
        {/* Balance + Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BalanceSection
            balance={balance}
            isLoading={isLoadingBalance}
            walletAddress={wallet.tempoAddress}
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

        {/* Activity Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActivityTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="pt-4">
            <ActivityPlaceholder filter="all" />
          </TabsContent>

          <TabsContent value="earnings" className="pt-4">
            <ActivityPlaceholder filter="earnings" />
          </TabsContent>

          <TabsContent value="sent" className="pt-4">
            <ActivityPlaceholder filter="sent" />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Full page mode
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">Manage your Tempo wallet and funds</p>
      </div>

      {/* Balance Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BalanceSection
              balance={balance}
              isLoading={isLoadingBalance}
              walletAddress={wallet.tempoAddress}
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

      {/* Activity Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActivityTab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <ActivityPlaceholder filter="all" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <ActivityPlaceholder filter="earnings" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <ActivityPlaceholder filter="sent" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
          <WithdrawContent balance={balance} />
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
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function BalanceSection({
  balance,
  isLoading,
  walletAddress,
}: {
  balance: number;
  isLoading: boolean;
  walletAddress: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-1">Balance</p>
      <div className="flex items-baseline gap-2">
        {isLoading ? (
          <span className="text-3xl font-bold text-muted-foreground animate-pulse">$---.--</span>
        ) : (
          <span className="text-3xl font-bold">${balance.toFixed(2)}</span>
        )}
        <span className="text-sm text-muted-foreground">USDC</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Address:</span>
        <AddressDisplay address={walletAddress} truncate />
      </div>
    </div>
  );
}

function ActivityPlaceholder({ filter }: { filter: ActivityTab }) {
  const content = {
    all: { title: 'No recent activity', desc: 'Transactions will appear here' },
    earnings: { title: 'No earnings yet', desc: 'Bounty payments will appear here' },
    sent: { title: 'No sent transactions', desc: 'Outgoing payments will appear here' },
  };

  return (
    <Empty className="py-8">
      <EmptyMedia variant="icon">
        <WalletIcon />
      </EmptyMedia>
      <EmptyTitle>{content[filter].title}</EmptyTitle>
      <EmptyDescription>{content[filter].desc}</EmptyDescription>
    </Empty>
  );
}

function FundContent({
  walletAddress,
  onDone,
}: {
  walletAddress: string;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>(
    'idle'
  );
  const [faucetMessage, setFaucetMessage] = useState('');

  const isTestnet = process.env.NEXT_PUBLIC_TEMPO_NETWORK === 'testnet';
  const networkName = isTestnet ? 'Tempo Testnet' : 'Tempo';
  const explorerUrl = isTestnet ? 'https://explore.testnet.tempo.xyz' : 'https://explore.tempo.xyz';

  // Truncate address for display: 0x1234...5678
  const truncatedAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  async function handleRequestTestTokens() {
    setFaucetStatus('requesting');
    setFaucetMessage('');

    try {
      const res = await fetch('/api/wallet/faucet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await res.json();

      if (res.ok) {
        setFaucetStatus('success');
        setFaucetMessage('Test tokens sent! Balance updates in ~30s');
      } else if (res.status === 429) {
        setFaucetStatus('error');
        const hours = Math.ceil((result.retryAfter || 86400) / 3600);
        setFaucetMessage(`Rate limited. Try again in ${hours}h`);
      } else {
        setFaucetStatus('error');
        setFaucetMessage(result.error || 'Request failed');
      }
    } catch {
      setFaucetStatus('error');
      setFaucetMessage('Network error');
    }
  }

  return (
    <div className="flex flex-col items-center py-2">
      {/* QR Code with subtle shadow */}
      <div className="rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <QRCodeSVG value={walletAddress} size={120} level="M" marginSize={0} />
      </div>

      {/* Address + Copy button */}
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCopy}
        className="mt-4 gap-2 rounded-full px-4"
      >
        <span className="font-mono">{truncatedAddress}</span>
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {/* Network badge */}
      <span className="mt-2 text-xs text-muted-foreground">{networkName}</span>

      {/* Instructions */}
      <p className="mt-4 max-w-[240px] text-center text-sm text-muted-foreground">
        Send USDC to this address to fund your wallet
      </p>

      {/* Explorer link */}
      <a
        href={`${explorerUrl}/address/${walletAddress}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        View on Explorer
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* Testnet Faucet - subtle link, only on testnet */}
      {isTestnet && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <Button
            variant="link"
            size="sm"
            onClick={handleRequestTestTokens}
            disabled={faucetStatus === 'requesting'}
            className="h-auto gap-1 p-0 text-xs text-muted-foreground"
          >
            <Droplet className="h-3 w-3" />
            {faucetStatus === 'requesting' ? 'Requesting...' : 'Get test tokens'}
          </Button>
          {faucetMessage && (
            <span
              className={`text-xs ${
                faucetStatus === 'success' ? 'text-success' : 'text-destructive'
              }`}
            >
              {faucetMessage}
            </span>
          )}
        </div>
      )}

      {/* Done button - only when callback provided */}
      {onDone && (
        <Button variant="ghost" size="sm" onClick={onDone} className="mt-4">
          Done
        </Button>
      )}
    </div>
  );
}

function WithdrawContent({ balance, onDone }: { balance: number; onDone?: () => void }) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');

  const numericAmount = Number.parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= balance;
  const isValidAddress = recipient.startsWith('0x') && recipient.length === 42;
  const isReady = isValidAmount && isValidAddress;
  const isSending = status === 'sending';

  const handleMaxClick = () => setAmount(balance.toFixed(2));

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSend = async () => {
    if (!isReady || isSending) return;
    setStatus('sending');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setStatus('error');
  };

  const amountError =
    amount && !isValidAmount
      ? numericAmount > balance
        ? 'Exceeds available balance'
        : undefined
      : undefined;
  const addressError = recipient && !isValidAddress ? 'Enter a valid Tempo address' : undefined;

  return (
    <div className="space-y-4 py-2">
      {/* Amount */}
      <Field>
        <FieldLabel>Amount</FieldLabel>
        <InputGroup className="h-9">
          <InputGroupAddon>$</InputGroupAddon>
          <InputGroupInput
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={handleAmountChange}
            aria-invalid={!!amountError}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={handleMaxClick}>Max</InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>${balance.toFixed(2)} available</FieldDescription>
        {amountError && <FieldError>{amountError}</FieldError>}
      </Field>

      {/* Recipient */}
      <Field>
        <FieldLabel>Recipient</FieldLabel>
        <InputGroup className="h-9">
          <InputGroupInput
            type="text"
            placeholder="0x..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            aria-invalid={!!addressError}
            className="font-mono"
          />
        </InputGroup>
        {addressError && <FieldError>{addressError}</FieldError>}
      </Field>

      {/* Send error */}
      {status === 'error' && <FieldError>Withdrawals not yet implemented</FieldError>}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2">
        <Button className="w-full gap-2" disabled={!isReady || isSending} onClick={handleSend}>
          <ArrowUpRight className="h-4 w-4" />
          {isSending ? 'Sending...' : 'Send'}
        </Button>
        {onDone && (
          <Button variant="ghost" size="sm" onClick={onDone} className="w-full">
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
