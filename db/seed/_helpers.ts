import { createHash } from "node:crypto";

// Deterministic ID generators - same input always produces same output
// This makes seeds reproducible across runs for debugging and testing

/**
 * Generate a stable nanoid-like ID (21 chars) from a namespace and key.
 * Same namespace+key always produces the same ID.
 */
export function stableId(namespace: string, key: string): string {
  const hex = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  // Convert hex to alphanumeric (nanoid-like format)
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 21; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    result += alphabet[byte % alphabet.length];
  }
  return result;
}

/**
 * Generate a stable UUID from a namespace and key.
 * Same namespace+key always produces the same UUID.
 */
export function stableUuid(namespace: string, key: string): string {
  const hex = createHash("sha256").update(`${namespace}:${key}`).digest("hex");
  // Format as UUID (not a real v4, but valid UUID string format)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Convert USD amount to BigInt with 6 decimals (TIP-20 standard)
export const usd = (amount: number): bigint =>
  BigInt(Math.round(amount * 1_000_000));

// Chain ID for Tempo Moderato testnet
export const CHAIN_ID = 42431;

// PathUSD token address on Tempo Moderato
export const PATHUSD_ADDRESS = "0x20c0000000000000000000000000000000000000";

// Generate realistic GitHub user ID (8 digits)
export const githubUserId = (seed: number): bigint =>
  BigInt(10_000_000 + seed * 123_456);

// Generate realistic GitHub repo ID (9 digits)
export const githubRepoId = (seed: number): bigint =>
  BigInt(100_000_000 + seed * 987_654);

// Generate realistic GitHub issue ID (10 digits)
export const githubIssueId = (repoSeed: number, issueNum: number): bigint =>
  BigInt(1_000_000_000 + repoSeed * 10_000 + issueNum);

// Generate realistic GitHub PR ID (10 digits)
export const githubPrId = (repoSeed: number, prNum: number): bigint =>
  BigInt(2_000_000_000 + repoSeed * 10_000 + prNum);

// Generate realistic GitHub org ID (7 digits)
export const githubOrgId = (seed: number): bigint =>
  BigInt(1_000_000 + seed * 54_321);

// Generate a valid-looking transaction hash
export const txHash = (seed: number): string => {
  const hex = seed.toString(16).padStart(8, "0");
  return `0x${hex.repeat(8)}`;
};

// Date helpers - create dates relative to a base date
const BASE_DATE = new Date("2024-06-01T00:00:00Z");

export const date = (daysFromBase: number, hours = 0): Date => {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() + daysFromBase);
  d.setHours(d.getHours() + hours);
  return d;
};

// ISO string version for business schema timestamps
export const dateStr = (daysFromBase: number, hours = 0): string =>
  date(daysFromBase, hours).toISOString();

// GitHub avatar URL generator
export const avatarUrl = (githubId: bigint): string =>
  `https://avatars.githubusercontent.com/u/${githubId}`;

// Common GitHub labels for bounties
export const LABELS = {
  bug: { id: 1, name: "bug", color: "d73a4a", description: "Something isn't working" },
  enhancement: { id: 2, name: "enhancement", color: "a2eeef", description: "New feature or request" },
  goodFirstIssue: { id: 3, name: "good first issue", color: "7057ff", description: "Good for newcomers" },
  documentation: { id: 4, name: "documentation", color: "0075ca", description: "Improvements or additions to documentation" },
  helpWanted: { id: 5, name: "help wanted", color: "008672", description: "Extra attention is needed" },
  priority: { id: 6, name: "priority", color: "b60205", description: "High priority issue" },
  performance: { id: 7, name: "performance", color: "fbca04", description: "Performance improvements" },
  security: { id: 8, name: "security", color: "ee0701", description: "Security vulnerability" },
} as const;

// Bounty status distribution helper
export type BountyStatus = "open" | "completed" | "cancelled";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "merged" | "paid" | "expired";
export type PayoutStatus = "pending" | "confirmed" | "failed";
