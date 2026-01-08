import { cn } from '@/lib/utils';
import { formatUnits } from 'viem';

interface TokenAmountProps {
  /** Amount as BigInt string (e.g., "1000000" for 1.0 tokens with 6 decimals) */
  amount: string;
  /** Token symbol (e.g., 'USDC') */
  symbol: string;
  /** Token decimals (defaults to 6 for USDC compatibility) */
  decimals?: number;
  /** Whether to show the symbol */
  showSymbol?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Formatted token amount display
 *
 * Displays amounts as "$1.00 USDC" format.
 * Accepts BigInt amounts as strings (serialized from database).
 * Converts from smallest units to display units using provided decimals.
 */
export function TokenAmount({
  amount,
  symbol,
  decimals = 6,
  showSymbol = true,
  className,
}: TokenAmountProps) {
  const formatted = formatUnits(BigInt(amount), decimals);

  return (
    <span className={cn('font-medium tabular-nums', className)}>
      ${formatted}
      {showSymbol && <span className="text-muted-foreground ml-1">{symbol}</span>}
    </span>
  );
}
