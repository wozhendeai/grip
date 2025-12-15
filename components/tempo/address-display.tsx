'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface AddressDisplayProps {
  /** Full blockchain address */
  address: string;
  /** Whether to truncate the address (default: true) */
  truncate?: boolean;
  /** Whether to show copy button (default: true) */
  copyable?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Blockchain address display with copy functionality
 *
 * Shows truncated address (0x1234...5678) with copy button.
 * Provides visual feedback on copy.
 */
export function AddressDisplay({
  address,
  truncate = true,
  copyable = true,
  className,
}: AddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const displayAddress = truncate ? truncateAddress(address) : address;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{displayAddress}</code>
      {copyable && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy address'}
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </span>
  );
}

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
