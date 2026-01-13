import { CHAIN_ID, PATHUSD_ADDRESS, dateStr } from "../_helpers";

// TIP-20 token allowlist - PathUSD is the primary stablecoin
export const tokens = [
  {
    address: PATHUSD_ADDRESS,
    chainId: CHAIN_ID,
    symbol: "PathUSD",
    name: "Path USD",
    decimals: 6,
    isActive: true,
    createdAt: dateStr(0),
  },
];
