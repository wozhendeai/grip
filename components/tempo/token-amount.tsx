import { formatTokenAmount } from '@/lib/tempo/format';
import { cn } from '@/lib/utils';

interface TokenAmountProps {
  /** Amount as BigInt string (e.g., "1000000" for 1.0 tokens with 6 decimals) */
  amount: string;
  /** Token symbol (e.g., 'USDC') */
  symbol: string;
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
 * Converts from smallest units (6 decimals) to display units.
 */
export function TokenAmount({ amount, symbol, showSymbol = true, className }: TokenAmountProps) {
  const formatted = formatTokenAmount(amount, { trim: true });

  return (
    <span className={cn('font-medium tabular-nums', className)}>
      ${formatted}
      {showSymbol && <span className="text-muted-foreground ml-1">{symbol}</span>}
    </span>
  );
}
