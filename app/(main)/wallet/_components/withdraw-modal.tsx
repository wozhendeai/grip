'use client';

import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { useState } from 'react';

/**
 * WithdrawModal - Modal for withdrawing USDC from wallet
 *
 * Allows users to send USDC to an external address.
 * Will require passkey signature for transaction signing.
 */

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance: number;
}

type WithdrawStep = 'form' | 'confirming' | 'success' | 'error';

export function WithdrawModal({ open, onOpenChange, balance }: WithdrawModalProps) {
  const [step, setStep] = useState<WithdrawStep>('form');
  const [amount, setAmount] = useState('');
  const [destination, setDestination] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; destination?: string }>({});

  const handleMaxClick = () => {
    setAmount(balance.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { amount?: string; destination?: string } = {};

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      newErrors.amount = 'Please enter a valid amount';
    } else if (amountNum > balance) {
      newErrors.amount = 'Insufficient balance';
    }

    if (!destination.startsWith('0x') || destination.length !== 42) {
      newErrors.destination = 'Please enter a valid Tempo address';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setStep('confirming');

    // TODO: Implement actual withdrawal with passkey signature
    // For now, simulate a delay and show success
    setTimeout(() => {
      setStep('success');
    }, 2000);
  };

  const handleClose = () => {
    setStep('form');
    setAmount('');
    setDestination('');
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 'success' ? 'Withdrawal Submitted' : 'Withdraw USDC'}</DialogTitle>
          <DialogDescription>
            {step === 'success'
              ? 'Your transaction has been submitted'
              : 'Send USDC to an external address on Tempo'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit} className="py-4">
            <FieldGroup>
              {/* Amount Input */}
              <Field data-invalid={!!errors.amount}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="amount">Amount</FieldLabel>
                  <span className="text-xs text-muted-foreground">
                    Balance: ${balance.toFixed(2)} USDC
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-16"
                    step="0.01"
                    min="0"
                    aria-invalid={!!errors.amount}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                    onClick={handleMaxClick}
                  >
                    MAX
                  </Button>
                </div>
                {errors.amount && <FieldError>{errors.amount}</FieldError>}
              </Field>

              {/* Destination Address */}
              <Field data-invalid={!!errors.destination}>
                <FieldLabel htmlFor="destination">Destination Address</FieldLabel>
                <Input
                  id="destination"
                  type="text"
                  placeholder="0x..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="font-mono text-sm"
                  aria-invalid={!!errors.destination}
                />
                <FieldDescription>Enter a Tempo network address</FieldDescription>
                {errors.destination && <FieldError>{errors.destination}</FieldError>}
              </Field>
            </FieldGroup>

            {/* Network Info */}
            <div className="rounded-lg bg-muted/50 p-4 mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">Tempo</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Network fee</span>
                <span className="font-medium">Sponsored</span>
              </div>
            </div>

            {/* Actions */}
            <ButtonGroup className="mt-6 w-full">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <ButtonGroupSeparator />
              <Button type="submit" className="flex-1">
                Continue
              </Button>
            </ButtonGroup>
          </form>
        )}

        {step === 'confirming' && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
            <p className="text-sm text-muted-foreground">Confirm with your passkey...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <Check className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Your withdrawal of ${amount} USDC has been submitted.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
