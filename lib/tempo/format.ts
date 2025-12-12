/**
 * BigInt formatting utilities for TIP-20 tokens
 *
 * TIP-20 tokens always use 6 decimals (enforced by protocol).
 * Amounts are stored as BigInt in database and must be serialized to strings for JSON.
 */

const DEFAULT_DECIMALS = 6;

/**
 * Format TIP-20 token amount for display
 *
 * Converts BigInt amount (with 6 decimals) to human-readable string.
 *
 * @param amount - BigInt or string amount (e.g., 1000000n = 1.0 tokens)
 * @param options - Formatting options
 * @returns Formatted string (e.g., "1.000000" or "1.00 USDC")
 *
 * @example
 * formatTokenAmount(1000000n) // "1.000000"
 * formatTokenAmount("1500000", { symbol: "USDC" }) // "1.500000 USDC"
 * formatTokenAmount(1500000n, { decimals: 6, symbol: "USDC", trim: true }) // "1.5 USDC"
 */
export function formatTokenAmount(
  amount: string | bigint,
  options?: {
    decimals?: number;
    symbol?: string;
    trim?: boolean; // Remove trailing zeros
  }
): string {
  const decimals = options?.decimals ?? DEFAULT_DECIMALS;
  const amt = typeof amount === 'string' ? BigInt(amount) : amount;

  const divisor = BigInt(10 ** decimals);
  const whole = amt / divisor;
  const frac = amt % divisor;

  // Format fractional part with leading zeros
  let fracStr = frac.toString().padStart(decimals, '0');

  // Optionally trim trailing zeros
  if (options?.trim) {
    fracStr = fracStr.replace(/0+$/, '') || '0';
  }

  const formatted = `${whole}.${fracStr}`;
  return options?.symbol ? `${formatted} ${options.symbol}` : formatted;
}

/**
 * Parse user input to TIP-20 amount (BigInt with 6 decimals)
 *
 * Converts human-readable string to BigInt for database storage.
 *
 * @param input - User input string (e.g., "1.5" or "10")
 * @param decimals - Number of decimals (default: 6)
 * @returns BigInt amount (e.g., 1500000n)
 *
 * @example
 * parseTokenAmount("1") // 1000000n
 * parseTokenAmount("1.5") // 1500000n
 * parseTokenAmount("0.000001") // 1n
 *
 * @throws Error if input is invalid
 */
export function parseTokenAmount(input: string, decimals = DEFAULT_DECIMALS): bigint {
  // Remove whitespace and validate basic format
  const cleaned = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid amount format: ${input}`);
  }

  const [whole = '0', frac = ''] = cleaned.split('.');

  // Pad or truncate fractional part to exact decimal places
  const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals);

  // Handle negative amounts
  const isNegative = whole.startsWith('-');
  const absoluteWhole = isNegative ? whole.slice(1) : whole;

  const amountStr = absoluteWhole + fracPadded;
  const amount = BigInt(amountStr);

  return isNegative ? -amount : amount;
}

/**
 * Format BigInt as string for JSON serialization
 *
 * Use this when returning amounts in API responses.
 *
 * @param amount - BigInt amount
 * @returns String representation
 *
 * @example
 * serializeBigInt(1000000n) // "1000000"
 */
export function serializeBigInt(amount: bigint): string {
  return amount.toString();
}

/**
 * Parse string to BigInt for database operations
 *
 * Use this when receiving amounts from API requests.
 *
 * @param amount - String amount
 * @returns BigInt
 *
 * @example
 * parseBigInt("1000000") // 1000000n
 *
 * @throws Error if input is invalid
 */
export function parseBigInt(amount: string): bigint {
  if (!/^-?\d+$/.test(amount)) {
    throw new Error(`Invalid BigInt format: ${amount}`);
  }
  return BigInt(amount);
}

/**
 * Format GitHub ID for display
 *
 * GitHub IDs are stored as BigInt but can be displayed as numbers
 * for most practical purposes (unless they exceed 2^53).
 *
 * @param id - BigInt GitHub ID
 * @returns Number or string
 *
 * @example
 * formatGithubId(123456789n) // 123456789
 */
export function formatGithubId(id: bigint): number | string {
  // Try to convert to number if safe
  try {
    const num = Number(id);
    if (Number.isSafeInteger(num)) {
      return num;
    }
  } catch {
    // Fall through to string
  }
  return id.toString();
}
