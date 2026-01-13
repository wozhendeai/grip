import { stableUuid, usd, CHAIN_ID, PATHUSD_ADDRESS, txHash, dateStr } from "../_helpers";
import { userIds } from "./users";
import { orgIds } from "./organizations";
import { bountyIds } from "./bounties";
import { submissionIds } from "./submissions";
import { repoIds } from "./repo-settings";
import type { PayoutStatus } from "../_helpers";

// Helper to create payout with deterministic ID
interface PayoutInput {
  key: string; // Unique key for deterministic ID generation
  submissionId: string;
  bountyId: string;
  repoSettingsId: bigint;
  payerUserId: string | null;
  payerOrganizationId: string | null;
  recipientUserId: string;
  recipientAddress: string;
  amount: bigint;
  txSeed: number;
  blockNumber: number;
  status: PayoutStatus;
  memoIssueNumber: number;
  memoPrNumber: number;
  memoContributor: string;
  createdDay: number;
  confirmedDay?: number;
  errorMessage?: string;
}

function createPayout(input: PayoutInput) {
  const isConfirmed = input.status === "confirmed";
  const isFailed = input.status === "failed";

  return {
    id: stableUuid("payout", input.key),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: input.submissionId,
    bountyId: input.bountyId,
    repoSettingsId: input.repoSettingsId,
    payerUserId: input.payerUserId,
    payerOrganizationId: input.payerOrganizationId,
    recipientUserId: input.recipientUserId,
    recipientPasskeyId: null,
    recipientAddress: input.recipientAddress,
    amount: input.amount,
    tokenAddress: PATHUSD_ADDRESS,
    txHash: isConfirmed ? txHash(input.txSeed) : null,
    blockNumber: isConfirmed ? BigInt(input.blockNumber) : null,
    confirmedAt: input.confirmedDay ? dateStr(input.confirmedDay) : null,
    memoIssueNumber: input.memoIssueNumber,
    memoPrNumber: input.memoPrNumber,
    memoContributor: input.memoContributor,
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: isConfirmed ? txHash(input.txSeed + 1000) : null,
    workReceiptLocator: isConfirmed
      ? `github:${input.memoContributor}/pr/${input.memoPrNumber}`
      : null,
    custodialWalletId: null,
    isCustodial: false,
    status: input.status,
    errorMessage: isFailed ? input.errorMessage : null,
    createdAt: dateStr(input.createdDay),
    updatedAt: dateStr(input.confirmedDay ?? input.createdDay),
  };
}

// Mock recipient addresses (Tempo P256 addresses)
const addresses = {
  johnContributor: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  carlosBackend: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
  priyaFrontend: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
  mariaDev: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
  davidFullstack: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
  firstTimer: "0xcd3B766CCDd6AE721141F452C550Ca635964ce71",
  openSourceFan: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
};

export const payouts = [
  // ========================================
  // CONFIRMED PAYOUTS (completed bounties)
  // ========================================

  createPayout({
    key: "loginBugPaid",
    submissionId: submissionIds.loginBugPaid,
    bountyId: bountyIds.acmeLoginBugCompleted,
    repoSettingsId: repoIds.acmeWebapp,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.johnContributor,
    recipientAddress: addresses.johnContributor,
    amount: usd(500),
    txSeed: 1001,
    blockNumber: 1_234_567,
    status: "confirmed",
    memoIssueNumber: 98,
    memoPrNumber: 99,
    memoContributor: "john-contributor",
    createdDay: 15,
    confirmedDay: 16,
  }),

  createPayout({
    key: "performancePaid",
    submissionId: submissionIds.performancePaid,
    bountyId: bountyIds.acmePerformanceCompleted,
    repoSettingsId: repoIds.acmeWebapp,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.carlosBackend,
    recipientAddress: addresses.carlosBackend,
    amount: usd(1200),
    txSeed: 1002,
    blockNumber: 1_345_678,
    status: "confirmed",
    memoIssueNumber: 112,
    memoPrNumber: 118,
    memoContributor: "carlos-backend",
    createdDay: 22,
    confirmedDay: 23,
  }),

  createPayout({
    key: "versionPaid",
    submissionId: submissionIds.versionPaid,
    bountyId: bountyIds.devtoolsVersionCompleted,
    repoSettingsId: repoIds.devtoolsCli,
    payerUserId: null,
    payerOrganizationId: orgIds.devToolsInc,
    recipientUserId: userIds.firstTimer,
    recipientAddress: addresses.firstTimer,
    amount: usd(100),
    txSeed: 1003,
    blockNumber: 1_123_456,
    status: "confirmed",
    memoIssueNumber: 45,
    memoPrNumber: 46,
    memoContributor: "first-timer-123",
    createdDay: 10,
    confirmedDay: 10,
  }),

  createPayout({
    key: "hookPaid",
    submissionId: submissionIds.hookPaid,
    bountyId: bountyIds.sarahHookCompleted,
    repoSettingsId: repoIds.sarahPersonal,
    payerUserId: userIds.sarahMaintainer,
    payerOrganizationId: null,
    recipientUserId: userIds.mariaDev,
    recipientAddress: addresses.mariaDev,
    amount: usd(50),
    txSeed: 1004,
    blockNumber: 1_456_789,
    status: "confirmed",
    memoIssueNumber: 15,
    memoPrNumber: 16,
    memoContributor: "maria-dev",
    createdDay: 26,
    confirmedDay: 26,
  }),

  createPayout({
    key: "utilPaid",
    submissionId: submissionIds.utilPaid,
    bountyId: bountyIds.ossUtilCompleted,
    repoSettingsId: repoIds.ossLibrary,
    payerUserId: null,
    payerOrganizationId: orgIds.openSourceCollective,
    recipientUserId: userIds.davidFullstack,
    recipientAddress: addresses.davidFullstack,
    amount: usd(200),
    txSeed: 1005,
    blockNumber: 1_234_890,
    status: "confirmed",
    memoIssueNumber: 32,
    memoPrNumber: 33,
    memoContributor: "david-fullstack",
    createdDay: 20,
    confirmedDay: 21,
  }),

  // ========================================
  // PENDING PAYOUTS (merged, awaiting tx)
  // ========================================

  createPayout({
    key: "securityMerged",
    submissionId: submissionIds.securityMerged,
    bountyId: bountyIds.acmeCriticalSecurity,
    repoSettingsId: repoIds.acmeWebapp,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.carlosBackend,
    recipientAddress: addresses.carlosBackend,
    amount: usd(3500),
    txSeed: 2001,
    blockNumber: 0,
    status: "pending",
    memoIssueNumber: 147,
    memoPrNumber: 152,
    memoContributor: "carlos-backend",
    createdDay: 40,
  }),

  // ========================================
  // Additional historical payouts for variety
  // ========================================

  // Earlier payout to maria
  {
    id: stableUuid("payout", "historical:maria:1"),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: repoIds.acmeWebapp,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.mariaDev,
    recipientPasskeyId: null,
    recipientAddress: addresses.mariaDev,
    amount: usd(350),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(901),
    blockNumber: BigInt(1_100_123),
    confirmedAt: dateStr(5),
    memoIssueNumber: 45,
    memoPrNumber: 48,
    memoContributor: "maria-dev",
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: txHash(1901),
    workReceiptLocator: "github:maria-dev/pr/48",
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(4),
    updatedAt: dateStr(5),
  },

  // Earlier payout to john
  {
    id: stableUuid("payout", "historical:john:1"),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: repoIds.devtoolsCli,
    payerUserId: null,
    payerOrganizationId: orgIds.devToolsInc,
    recipientUserId: userIds.johnContributor,
    recipientPasskeyId: null,
    recipientAddress: addresses.johnContributor,
    amount: usd(275),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(902),
    blockNumber: BigInt(1_050_234),
    confirmedAt: dateStr(3),
    memoIssueNumber: 22,
    memoPrNumber: 25,
    memoContributor: "john-contributor",
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: txHash(1902),
    workReceiptLocator: "github:john-contributor/pr/25",
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(2),
    updatedAt: dateStr(3),
  },

  // Payout to david
  {
    id: stableUuid("payout", "historical:david:1"),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: repoIds.ossLibrary,
    payerUserId: null,
    payerOrganizationId: orgIds.openSourceCollective,
    recipientUserId: userIds.davidFullstack,
    recipientPasskeyId: null,
    recipientAddress: addresses.davidFullstack,
    amount: usd(425),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(903),
    blockNumber: BigInt(1_080_567),
    confirmedAt: dateStr(8),
    memoIssueNumber: 18,
    memoPrNumber: 21,
    memoContributor: "david-fullstack",
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: txHash(1903),
    workReceiptLocator: "github:david-fullstack/pr/21",
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(7),
    updatedAt: dateStr(8),
  },

  // Payout to carlos
  {
    id: stableUuid("payout", "historical:carlos:1"),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: repoIds.acmeApi,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.carlosBackend,
    recipientPasskeyId: null,
    recipientAddress: addresses.carlosBackend,
    amount: usd(800),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(904),
    blockNumber: BigInt(1_150_890),
    confirmedAt: dateStr(12),
    memoIssueNumber: 67,
    memoPrNumber: 72,
    memoContributor: "carlos-backend",
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: txHash(1904),
    workReceiptLocator: "github:carlos-backend/pr/72",
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(11),
    updatedAt: dateStr(12),
  },

  // Payout to priya
  {
    id: stableUuid("payout", "historical:priya:1"),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: repoIds.acmeWebapp,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.priyaFrontend,
    recipientPasskeyId: null,
    recipientAddress: addresses.priyaFrontend,
    amount: usd(550),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(905),
    blockNumber: BigInt(1_200_123),
    confirmedAt: dateStr(18),
    memoIssueNumber: 89,
    memoPrNumber: 94,
    memoContributor: "priya-frontend",
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: txHash(1905),
    workReceiptLocator: "github:priya-frontend/pr/94",
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(17),
    updatedAt: dateStr(18),
  },

  // Payout to opensource-enthusiast
  {
    id: stableUuid("payout", "historical:ossFan:1"),
    chainId: CHAIN_ID,
    paymentType: "bounty" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: repoIds.sarahPersonal,
    payerUserId: userIds.sarahMaintainer,
    payerOrganizationId: null,
    recipientUserId: userIds.openSourceFan,
    recipientPasskeyId: null,
    recipientAddress: addresses.openSourceFan,
    amount: usd(75),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(906),
    blockNumber: BigInt(1_180_456),
    confirmedAt: dateStr(15),
    memoIssueNumber: 8,
    memoPrNumber: 10,
    memoContributor: "opensource-enthusiast",
    memoBytes32: null,
    memoMessage: null,
    workReceiptHash: txHash(1906),
    workReceiptLocator: "github:opensource-enthusiast/pr/10",
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(14),
    updatedAt: dateStr(15),
  },

  // ========================================
  // DIRECT PAYMENTS (non-bounty)
  // ========================================

  // Direct payment from Acme to carlos for consulting
  {
    id: stableUuid("payout", "direct:acme:carlos:consulting"),
    chainId: CHAIN_ID,
    paymentType: "direct" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: null,
    payerUserId: null,
    payerOrganizationId: orgIds.acmeLabs,
    recipientUserId: userIds.carlosBackend,
    recipientPasskeyId: null,
    recipientAddress: addresses.carlosBackend,
    amount: usd(2500),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(907),
    blockNumber: BigInt(1_250_789),
    confirmedAt: dateStr(25),
    memoIssueNumber: null,
    memoPrNumber: null,
    memoContributor: null,
    memoBytes32: null,
    memoMessage: "Security consulting fee - Q2 review",
    workReceiptHash: null,
    workReceiptLocator: null,
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(24),
    updatedAt: dateStr(25),
  },

  // Direct tip from james to david
  {
    id: stableUuid("payout", "direct:james:david:tip"),
    chainId: CHAIN_ID,
    paymentType: "direct" as const,
    submissionId: null,
    bountyId: null,
    repoSettingsId: null,
    payerUserId: userIds.jamesWilson,
    payerOrganizationId: null,
    recipientUserId: userIds.davidFullstack,
    recipientPasskeyId: null,
    recipientAddress: addresses.davidFullstack,
    amount: usd(100),
    tokenAddress: PATHUSD_ADDRESS,
    txHash: txHash(908),
    blockNumber: BigInt(1_280_234),
    confirmedAt: dateStr(30),
    memoIssueNumber: null,
    memoPrNumber: null,
    memoContributor: null,
    memoBytes32: null,
    memoMessage: "Thanks for the help with CLI refactor!",
    workReceiptHash: null,
    workReceiptLocator: null,
    custodialWalletId: null,
    isCustodial: false,
    status: "confirmed" as const,
    errorMessage: null,
    createdAt: dateStr(29),
    updatedAt: dateStr(30),
  },
];
