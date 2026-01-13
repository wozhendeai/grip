import { stableUuid, usd, CHAIN_ID, PATHUSD_ADDRESS, dateStr } from "../_helpers";
import { userIds } from "./users";
import { orgIds } from "./organizations";
import { bountyIds } from "./bounties";

// Helper to create funder entry with deterministic ID
interface FunderInput {
  key: string; // Unique key for deterministic ID generation
  bountyId: string;
  funderId: string | null;
  organizationId: string | null;
  amount: bigint;
  createdDay: number;
  withdrawnDay?: number;
}

function createFunder(input: FunderInput) {
  return {
    id: stableUuid("bountyFunder", input.key),
    bountyId: input.bountyId,
    funderId: input.funderId,
    organizationId: input.organizationId,
    amount: input.amount,
    tokenAddress: PATHUSD_ADDRESS,
    chainId: CHAIN_ID,
    createdAt: dateStr(input.createdDay),
    withdrawnAt: input.withdrawnDay ? dateStr(input.withdrawnDay) : null,
  };
}

export const bountyFunders = [
  // ========================================
  // SCENARIO 1: Acme Labs Bounties
  // Single org funder for most
  // ========================================

  createFunder({
    key: "acmeWebsocket:acmeLabs",
    bountyId: bountyIds.acmeWebsocket,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(1500),
    createdDay: 35,
  }),

  createFunder({
    key: "acmeOauth:acmeLabs",
    bountyId: bountyIds.acmeOauth,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(2000),
    createdDay: 40,
  }),

  createFunder({
    key: "acmeDashboard:acmeLabs",
    bountyId: bountyIds.acmeDashboard,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(800),
    createdDay: 42,
  }),

  createFunder({
    key: "acmeTypescript:acmeLabs",
    bountyId: bountyIds.acmeTypescript,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(300),
    createdDay: 45,
  }),

  createFunder({
    key: "acmeDarkMode:acmeLabs",
    bountyId: bountyIds.acmeDarkMode,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(500),
    createdDay: 48,
  }),

  createFunder({
    key: "acmeRateLimiting:acmeLabs",
    bountyId: bountyIds.acmeRateLimiting,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(1200),
    createdDay: 38,
  }),

  createFunder({
    key: "acmeCsvExport:acmeLabs",
    bountyId: bountyIds.acmeCsvExport,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(400),
    createdDay: 50,
  }),

  createFunder({
    key: "acmeMobileLayout:acmeLabs",
    bountyId: bountyIds.acmeMobileLayout,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(150),
    createdDay: 52,
  }),

  createFunder({
    key: "acmeApiDocs:acmeLabs",
    bountyId: bountyIds.acmeApiDocs,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(600),
    createdDay: 44,
  }),

  createFunder({
    key: "acmeTestCoverage:acmeLabs",
    bountyId: bountyIds.acmeTestCoverage,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(1000),
    createdDay: 54,
  }),

  // ========================================
  // SCENARIO 2: Multi-Funder Critical Security
  // Total: $3500 from 4 funders
  // ========================================

  createFunder({
    key: "acmeCriticalSecurity:acmeLabs",
    bountyId: bountyIds.acmeCriticalSecurity,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(1500),
    createdDay: 30,
  }),

  createFunder({
    key: "acmeCriticalSecurity:mikeFunder",
    bountyId: bountyIds.acmeCriticalSecurity,
    funderId: userIds.mikeFunder,
    organizationId: null,
    amount: usd(800),
    createdDay: 31,
  }),

  createFunder({
    key: "acmeCriticalSecurity:emmaInvestor",
    bountyId: bountyIds.acmeCriticalSecurity,
    funderId: userIds.emmaInvestor,
    organizationId: null,
    amount: usd(700),
    createdDay: 32,
  }),

  createFunder({
    key: "acmeCriticalSecurity:techVentures",
    bountyId: bountyIds.acmeCriticalSecurity,
    funderId: userIds.techVentures,
    organizationId: null,
    amount: usd(500),
    createdDay: 33,
  }),

  // ========================================
  // SCENARIO 3: Sarah's Personal Bounties
  // ========================================

  createFunder({
    key: "sarahUseDebounce:sarah",
    bountyId: bountyIds.sarahUseDebounce,
    funderId: userIds.sarahMaintainer,
    organizationId: null,
    amount: usd(75),
    createdDay: 55,
  }),

  createFunder({
    key: "sarahUseLocalStorage:sarah",
    bountyId: bountyIds.sarahUseLocalStorage,
    funderId: userIds.sarahMaintainer,
    organizationId: null,
    amount: usd(100),
    createdDay: 56,
  }),

  createFunder({
    key: "sarahDocumentation:sarah",
    bountyId: bountyIds.sarahDocumentation,
    funderId: userIds.sarahMaintainer,
    organizationId: null,
    amount: usd(50),
    createdDay: 58,
  }),

  // ========================================
  // SCENARIO 4: DevTools CLI Refactor
  // ========================================

  createFunder({
    key: "devtoolsCliRefactor:devToolsInc",
    bountyId: bountyIds.devtoolsCliRefactor,
    funderId: null,
    organizationId: orgIds.devToolsInc,
    amount: usd(750),
    createdDay: 32,
  }),

  // ========================================
  // SCENARIO 5: Withdrawn Funder
  // ========================================

  createFunder({
    key: "ossValidation:ossCollective",
    bountyId: bountyIds.ossValidation,
    funderId: null,
    organizationId: orgIds.openSourceCollective,
    amount: usd(400),
    createdDay: 25,
  }),

  createFunder({
    key: "ossValidation:mikeFunder:withdrawn",
    bountyId: bountyIds.ossValidation,
    funderId: userIds.mikeFunder,
    organizationId: null,
    amount: usd(200),
    createdDay: 26,
    withdrawnDay: 40,
  }),

  // ========================================
  // Additional DevTools Bounties
  // ========================================

  createFunder({
    key: "devtoolsAutoComplete:devToolsInc",
    bountyId: bountyIds.devtoolsAutoComplete,
    funderId: null,
    organizationId: orgIds.devToolsInc,
    amount: usd(350),
    createdDay: 46,
  }),

  createFunder({
    key: "devtoolsColorOutput:devToolsInc",
    bountyId: bountyIds.devtoolsColorOutput,
    funderId: null,
    organizationId: orgIds.devToolsInc,
    amount: usd(200),
    createdDay: 49,
  }),

  createFunder({
    key: "devtoolsConfigFile:devToolsInc",
    bountyId: bountyIds.devtoolsConfigFile,
    funderId: null,
    organizationId: orgIds.devToolsInc,
    amount: usd(450),
    createdDay: 51,
  }),

  // ========================================
  // Additional OSS Collective Bounties
  // ========================================

  createFunder({
    key: "ossTreeShaking:ossCollective",
    bountyId: bountyIds.ossTreeShaking,
    funderId: null,
    organizationId: orgIds.openSourceCollective,
    amount: usd(500),
    createdDay: 47,
  }),

  createFunder({
    key: "ossTypeDefs:ossCollective",
    bountyId: bountyIds.ossTypeDefs,
    funderId: null,
    organizationId: orgIds.openSourceCollective,
    amount: usd(300),
    createdDay: 53,
  }),

  // ========================================
  // Lili's Side Project
  // ========================================

  createFunder({
    key: "liliTempoHooks:lili",
    bountyId: bountyIds.liliTempoHooks,
    funderId: userIds.liliChen,
    organizationId: null,
    amount: usd(250),
    createdDay: 57,
  }),

  // ========================================
  // Additional Acme API Bounties
  // ========================================

  createFunder({
    key: "acmeApiPagination:acmeLabs",
    bountyId: bountyIds.acmeApiPagination,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(650),
    createdDay: 43,
  }),

  createFunder({
    key: "acmeApiCaching:acmeLabs",
    bountyId: bountyIds.acmeApiCaching,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(900),
    createdDay: 41,
  }),

  createFunder({
    key: "acmeApiWebhooks:acmeLabs",
    bountyId: bountyIds.acmeApiWebhooks,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(1100),
    createdDay: 39,
  }),

  // ========================================
  // Completed Bounties - Historical Funders
  // ========================================

  createFunder({
    key: "acmeLoginBugCompleted:acmeLabs",
    bountyId: bountyIds.acmeLoginBugCompleted,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(500),
    createdDay: 10,
  }),

  createFunder({
    key: "acmePerformanceCompleted:acmeLabs",
    bountyId: bountyIds.acmePerformanceCompleted,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(1200),
    createdDay: 12,
  }),

  createFunder({
    key: "devtoolsVersionCompleted:devToolsInc",
    bountyId: bountyIds.devtoolsVersionCompleted,
    funderId: null,
    organizationId: orgIds.devToolsInc,
    amount: usd(100),
    createdDay: 8,
  }),

  createFunder({
    key: "sarahHookCompleted:sarah",
    bountyId: bountyIds.sarahHookCompleted,
    funderId: userIds.sarahMaintainer,
    organizationId: null,
    amount: usd(50),
    createdDay: 20,
  }),

  createFunder({
    key: "ossUtilCompleted:ossCollective",
    bountyId: bountyIds.ossUtilCompleted,
    funderId: null,
    organizationId: orgIds.openSourceCollective,
    amount: usd(200),
    createdDay: 15,
  }),

  // ========================================
  // Cancelled Bounties - Withdrawn Funds
  // ========================================

  createFunder({
    key: "acmeLegacyCancelled:acmeLabs",
    bountyId: bountyIds.acmeLegacyCancelled,
    funderId: null,
    organizationId: orgIds.acmeLabs,
    amount: usd(800),
    createdDay: 5,
    withdrawnDay: 15,
  }),

  createFunder({
    key: "devtoolsDeprecatedCancelled:devToolsInc",
    bountyId: bountyIds.devtoolsDeprecatedCancelled,
    funderId: null,
    organizationId: orgIds.devToolsInc,
    amount: usd(500),
    createdDay: 3,
    withdrawnDay: 8,
  }),

  createFunder({
    key: "ossAbandonedCancelled:ossCollective",
    bountyId: bountyIds.ossAbandonedCancelled,
    funderId: null,
    organizationId: orgIds.openSourceCollective,
    amount: usd(350),
    createdDay: 2,
    withdrawnDay: 20,
  }),

  // ========================================
  // Extra funders for variety
  // ========================================

  createFunder({
    key: "acmeDashboard:jamesWilson",
    bountyId: bountyIds.acmeDashboard,
    funderId: userIds.jamesWilson,
    organizationId: null,
    amount: usd(200),
    createdDay: 43,
  }),

  createFunder({
    key: "acmeWebsocket:liliChen",
    bountyId: bountyIds.acmeWebsocket,
    funderId: userIds.liliChen,
    organizationId: null,
    amount: usd(300),
    createdDay: 36,
  }),

  createFunder({
    key: "ossTreeShaking:emmaInvestor",
    bountyId: bountyIds.ossTreeShaking,
    funderId: userIds.emmaInvestor,
    organizationId: null,
    amount: usd(150),
    createdDay: 48,
  }),

  createFunder({
    key: "acmeTypescript:mikeFunder",
    bountyId: bountyIds.acmeTypescript,
    funderId: userIds.mikeFunder,
    organizationId: null,
    amount: usd(100),
    createdDay: 46,
  }),

  createFunder({
    key: "devtoolsColorOutput:mikeFunder",
    bountyId: bountyIds.devtoolsColorOutput,
    funderId: userIds.mikeFunder,
    organizationId: null,
    amount: usd(50),
    createdDay: 50,
  }),
];
