'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ArrowUpRight, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { parseUnits } from 'viem';
import { Hooks } from 'wagmi/tempo';

interface WithdrawContentProps {
  balance: number;
  tokenAddress: `0x${string}` | undefined;
  decimals: number;
  tokenSymbol: string | undefined;
  onDone?: () => void;
}

export function WithdrawContent({
  balance,
  tokenAddress,
  decimals,
  tokenSymbol,
  onDone,
}: WithdrawContentProps) {
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');

  const transfer = Hooks.token.useTransferSync();

  const numericAmount = Number.parseFloat(amount) || 0;
  const isValidAmount = numericAmount > 0 && numericAmount <= balance;
  const isValidAddress = recipient.startsWith('0x') && recipient.length === 42;
  const hasToken = Boolean(tokenAddress);
  const isReady = isValidAmount && isValidAddress && hasToken;
  const isSending = transfer.isPending;
  const isSuccess = transfer.isSuccess;

  const handleMaxClick = () => setAmount(balance.toFixed(2));

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSend = () => {
    if (!isReady || isSending || !tokenAddress) return;

    transfer.mutate({
      amount: parseUnits(amount, decimals),
      to: recipient as `0x${string}`,
      token: tokenAddress,
    });
  };

  const handleReset = () => {
    setAmount('');
    setRecipient('');
    transfer.reset();
  };

  const amountError =
    amount && !isValidAmount
      ? numericAmount > balance
        ? 'Exceeds available balance'
        : undefined
      : undefined;
  const addressError = recipient && !isValidAddress ? 'Enter a valid Tempo address' : undefined;

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-4 py-2 text-center">
        <CheckCircle className="h-12 w-12 text-success mx-auto" />
        <div>
          <p className="font-medium">Transfer Complete</p>
          <p className="text-sm text-muted-foreground">
            Sent ${numericAmount.toFixed(2)} {tokenSymbol}
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button variant="outline" onClick={handleReset} className="w-full">
            Send Another
          </Button>
          {onDone && (
            <Button variant="ghost" size="sm" onClick={onDone} className="w-full">
              Done
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* No token selected warning */}
      {!hasToken && (
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
          Select a fee token in wallet settings to enable withdrawals.
        </div>
      )}

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
            disabled={!hasToken}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton onClick={handleMaxClick} disabled={!hasToken}>
              Max
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldDescription>
          ${balance.toFixed(2)} {tokenSymbol} available
        </FieldDescription>
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
            disabled={!hasToken}
          />
        </InputGroup>
        {addressError && <FieldError>{addressError}</FieldError>}
      </Field>

      {/* Transfer error */}
      {transfer.isError && (
        <FieldError>{transfer.error?.message || 'Transfer failed. Please try again.'}</FieldError>
      )}

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
