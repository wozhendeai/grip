import {
  stableUuid,
  usd,
  CHAIN_ID,
  PATHUSD_ADDRESS,
  githubIssueId,
  dateStr,
  LABELS,
  type BountyStatus,
} from "../_helpers";
import { userIds } from "./users";
import { orgIds } from "./organizations";
import { repoIds } from "./repo-settings";

// Deterministic bounty IDs - same every run for reproducibility
const bountyIds = {
  // Scenario 1: Acme Labs active bounties
  acmeWebsocket: stableUuid("bounty", "acmeWebsocket"),
  acmeOauth: stableUuid("bounty", "acmeOauth"),
  acmeDashboard: stableUuid("bounty", "acmeDashboard"),
  acmeTypescript: stableUuid("bounty", "acmeTypescript"),
  acmeDarkMode: stableUuid("bounty", "acmeDarkMode"),
  acmeRateLimiting: stableUuid("bounty", "acmeRateLimiting"),
  acmeCsvExport: stableUuid("bounty", "acmeCsvExport"),
  acmeMobileLayout: stableUuid("bounty", "acmeMobileLayout"),
  acmeApiDocs: stableUuid("bounty", "acmeApiDocs"),
  acmeTestCoverage: stableUuid("bounty", "acmeTestCoverage"),

  // Scenario 2: High-priority multi-funder bounty
  acmeCriticalSecurity: stableUuid("bounty", "acmeCriticalSecurity"),

  // Scenario 3: Sarah's personal repo bounties
  sarahUseDebounce: stableUuid("bounty", "sarahUseDebounce"),
  sarahUseLocalStorage: stableUuid("bounty", "sarahUseLocalStorage"),
  sarahDocumentation: stableUuid("bounty", "sarahDocumentation"),

  // Scenario 4: Rejected and resubmitted
  devtoolsCliRefactor: stableUuid("bounty", "devtoolsCliRefactor"),

  // Scenario 5: Withdrawn funder
  ossValidation: stableUuid("bounty", "ossValidation"),

  // Additional bounties for variety
  devtoolsAutoComplete: stableUuid("bounty", "devtoolsAutoComplete"),
  devtoolsColorOutput: stableUuid("bounty", "devtoolsColorOutput"),
  devtoolsConfigFile: stableUuid("bounty", "devtoolsConfigFile"),
  ossTreeShaking: stableUuid("bounty", "ossTreeShaking"),
  ossTypeDefs: stableUuid("bounty", "ossTypeDefs"),
  liliTempoHooks: stableUuid("bounty", "liliTempoHooks"),
  acmeApiPagination: stableUuid("bounty", "acmeApiPagination"),
  acmeApiCaching: stableUuid("bounty", "acmeApiCaching"),
  acmeApiWebhooks: stableUuid("bounty", "acmeApiWebhooks"),

  // Completed bounties (historical)
  acmeLoginBugCompleted: stableUuid("bounty", "acmeLoginBugCompleted"),
  acmePerformanceCompleted: stableUuid("bounty", "acmePerformanceCompleted"),
  devtoolsVersionCompleted: stableUuid("bounty", "devtoolsVersionCompleted"),
  sarahHookCompleted: stableUuid("bounty", "sarahHookCompleted"),
  ossUtilCompleted: stableUuid("bounty", "ossUtilCompleted"),

  // Cancelled bounties
  acmeLegacyCancelled: stableUuid("bounty", "acmeLegacyCancelled"),
  devtoolsDeprecatedCancelled: stableUuid("bounty", "devtoolsDeprecatedCancelled"),
  ossAbandonedCancelled: stableUuid("bounty", "ossAbandonedCancelled"),
} as const;

export { bountyIds };

// Helper to create bounty data
interface BountyInput {
  id: string;
  repoId: bigint;
  owner: string;
  repo: string;
  issueNum: number;
  title: string;
  body: string | null;
  labels: typeof LABELS[keyof typeof LABELS][];
  totalFunded: bigint;
  primaryFunderId: string | null;
  organizationId: string | null;
  status: BountyStatus;
  createdDay: number;
  approvedDay?: number;
  paidDay?: number;
  cancelledDay?: number;
}

function createBounty(input: BountyInput) {
  const repoSeed = Number(input.repoId % BigInt(1000));
  return {
    id: input.id,
    chainId: CHAIN_ID,
    repoSettingsId: input.repoId,
    githubRepoId: input.repoId,
    githubOwner: input.owner,
    githubRepo: input.repo,
    githubFullName: `${input.owner}/${input.repo}`,
    githubIssueNumber: input.issueNum,
    githubIssueId: githubIssueId(repoSeed, input.issueNum),
    githubIssueAuthorId: null,
    title: input.title,
    body: input.body,
    labels: input.labels,
    totalFunded: input.totalFunded,
    tokenAddress: PATHUSD_ADDRESS,
    primaryFunderId: input.primaryFunderId,
    organizationId: input.organizationId,
    status: input.status,
    approvedAt: input.approvedDay ? dateStr(input.approvedDay) : null,
    ownerApprovedAt: input.approvedDay ? dateStr(input.approvedDay, 1) : null,
    paidAt: input.paidDay ? dateStr(input.paidDay) : null,
    cancelledAt: input.cancelledDay ? dateStr(input.cancelledDay) : null,
    createdAt: dateStr(input.createdDay),
    updatedAt: dateStr(input.paidDay ?? input.cancelledDay ?? input.approvedDay ?? input.createdDay + 1),
  };
}

export const bounties = [
  // ========================================
  // SCENARIO 1: Acme Labs Active Project
  // ========================================

  // Open bounties on acme-labs/webapp
  createBounty({
    id: bountyIds.acmeWebsocket,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 142,
    title: "Memory leak in WebSocket connection handler",
    body: "The WebSocket handler doesn't properly clean up connections when clients disconnect unexpectedly. This causes memory usage to grow over time in production.\n\n**Steps to reproduce:**\n1. Open 100+ concurrent WebSocket connections\n2. Force-close browser tabs\n3. Monitor server memory\n\n**Expected:** Memory returns to baseline\n**Actual:** Memory keeps growing",
    labels: [LABELS.bug, LABELS.priority],
    totalFunded: usd(1500),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 35,
  }),

  createBounty({
    id: bountyIds.acmeOauth,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 156,
    title: "Add support for custom OAuth providers",
    body: "Allow users to configure their own OAuth providers beyond GitHub, Google, and Microsoft.\n\n**Requirements:**\n- Support generic OAuth 2.0 / OIDC providers\n- Admin UI for configuring providers\n- Token refresh handling\n- Proper error messages for misconfigured providers",
    labels: [LABELS.enhancement, LABELS.helpWanted],
    totalFunded: usd(2000),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 40,
  }),

  createBounty({
    id: bountyIds.acmeDashboard,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 163,
    title: "Dashboard loading slow with >1000 items",
    body: "Dashboard becomes unresponsive when displaying large datasets. Need to implement virtualization or pagination.\n\n**Acceptance criteria:**\n- Dashboard loads in <2s with 10k items\n- Smooth scrolling\n- Search still works instantly",
    labels: [LABELS.performance, LABELS.bug],
    totalFunded: usd(800),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 42,
  }),

  createBounty({
    id: bountyIds.acmeTypescript,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 171,
    title: "TypeScript strict mode violations in auth module",
    body: "The auth module has 47 TypeScript errors when `strict: true` is enabled. We want to enable strict mode project-wide.\n\n**Files to fix:**\n- `src/lib/auth/*.ts`\n- `src/middleware/auth.ts`\n- `src/hooks/useAuth.ts`",
    labels: [LABELS.enhancement, LABELS.goodFirstIssue],
    totalFunded: usd(300),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 45,
  }),

  createBounty({
    id: bountyIds.acmeDarkMode,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 178,
    title: "Implement dark mode for settings page",
    body: "The settings page doesn't respect the system dark mode preference. Need to add proper theming.\n\n**Requirements:**\n- Respect `prefers-color-scheme`\n- Manual toggle in settings\n- Persist preference to localStorage\n- Smooth transition animation",
    labels: [LABELS.enhancement],
    totalFunded: usd(500),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 48,
  }),

  createBounty({
    id: bountyIds.acmeRateLimiting,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    issueNum: 89,
    title: "API rate limiting not working correctly",
    body: "Rate limiting middleware is not properly tracking requests per IP. Users can exceed limits by rotating through endpoints.",
    labels: [LABELS.bug, LABELS.security],
    totalFunded: usd(1200),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 38,
  }),

  createBounty({
    id: bountyIds.acmeCsvExport,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 185,
    title: "Add CSV export for analytics data",
    body: "Users need to export analytics data for reporting. Add CSV export with date range filtering.",
    labels: [LABELS.enhancement],
    totalFunded: usd(400),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 50,
  }),

  createBounty({
    id: bountyIds.acmeMobileLayout,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 192,
    title: "Fix mobile responsive layout on profile page",
    body: "Profile page breaks on mobile devices under 375px width. Avatar overlaps with name and stats are cut off.",
    labels: [LABELS.bug, LABELS.goodFirstIssue],
    totalFunded: usd(150),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 52,
  }),

  createBounty({
    id: bountyIds.acmeApiDocs,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    issueNum: 95,
    title: "Add OpenAPI documentation for all endpoints",
    body: "Generate and maintain OpenAPI 3.0 spec for all API endpoints with examples.",
    labels: [LABELS.documentation, LABELS.helpWanted],
    totalFunded: usd(600),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 44,
  }),

  createBounty({
    id: bountyIds.acmeTestCoverage,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 199,
    title: "Increase test coverage to 80%",
    body: "Current test coverage is at 45%. Need to add unit and integration tests to reach 80% coverage threshold.",
    labels: [LABELS.enhancement],
    totalFunded: usd(1000),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 54,
  }),

  // ========================================
  // SCENARIO 2: High-Priority Multi-Funder
  // ========================================

  createBounty({
    id: bountyIds.acmeCriticalSecurity,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 147,
    title: "Critical: SQL injection vulnerability in search endpoint",
    body: "**SECURITY VULNERABILITY**\n\nThe search endpoint is vulnerable to SQL injection via the `q` parameter. This allows attackers to extract sensitive data.\n\n**Severity:** Critical\n**CVSS Score:** 9.8\n\n**DO NOT DISCLOSE** - responsible disclosure in progress.\n\nBounty pool increased due to severity. Fix must include:\n- Parameterized queries\n- Input validation\n- Security audit of similar patterns\n- Regression tests",
    labels: [LABELS.security, LABELS.priority, LABELS.bug],
    totalFunded: usd(3500), // Multiple funders contributed
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 30,
  }),

  // ========================================
  // SCENARIO 3: Sarah's Personal Repo
  // ========================================

  createBounty({
    id: bountyIds.sarahUseDebounce,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    issueNum: 23,
    title: "Add useDebounce hook",
    body: "Add a useDebounce hook that delays updating a value until after a specified delay.\n\n```tsx\nconst debouncedValue = useDebounce(value, 500);\n```",
    labels: [LABELS.enhancement, LABELS.goodFirstIssue],
    totalFunded: usd(75),
    primaryFunderId: userIds.sarahMaintainer,
    organizationId: null,
    status: "open",
    createdDay: 55,
  }),

  createBounty({
    id: bountyIds.sarahUseLocalStorage,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    issueNum: 28,
    title: "Add useLocalStorage hook with SSR support",
    body: "Hook to sync state with localStorage that works with SSR frameworks like Next.js.",
    labels: [LABELS.enhancement],
    totalFunded: usd(100),
    primaryFunderId: userIds.sarahMaintainer,
    organizationId: null,
    status: "open",
    createdDay: 56,
  }),

  createBounty({
    id: bountyIds.sarahDocumentation,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    issueNum: 31,
    title: "Improve README with usage examples",
    body: "The README needs better documentation with copy-paste examples for each hook.",
    labels: [LABELS.documentation, LABELS.goodFirstIssue],
    totalFunded: usd(50),
    primaryFunderId: userIds.sarahMaintainer,
    organizationId: null,
    status: "open",
    createdDay: 58,
  }),

  // ========================================
  // SCENARIO 4: Rejected and Resubmitted
  // ========================================

  createBounty({
    id: bountyIds.devtoolsCliRefactor,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    issueNum: 67,
    title: "Refactor argument parser to support subcommands",
    body: "Current CLI only supports flat arguments. Need to refactor to support git-style subcommands:\n\n```\ndevtools init\ndevtools config set key value\ndevtools run --verbose\n```",
    labels: [LABELS.enhancement],
    totalFunded: usd(750),
    primaryFunderId: null,
    organizationId: orgIds.devToolsInc,
    status: "open",
    createdDay: 32,
  }),

  // ========================================
  // SCENARIO 5: Withdrawn Funder
  // ========================================

  createBounty({
    id: bountyIds.ossValidation,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    issueNum: 45,
    title: "Add schema validation utilities",
    body: "Add lightweight schema validation functions similar to Zod but with smaller bundle size.",
    labels: [LABELS.enhancement],
    totalFunded: usd(400), // Originally 600, but one funder withdrew 200
    primaryFunderId: null,
    organizationId: orgIds.openSourceCollective,
    status: "open",
    createdDay: 25,
  }),

  // ========================================
  // Additional Open Bounties
  // ========================================

  createBounty({
    id: bountyIds.devtoolsAutoComplete,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    issueNum: 72,
    title: "Add shell autocomplete support",
    body: "Generate shell completion scripts for bash, zsh, and fish.",
    labels: [LABELS.enhancement],
    totalFunded: usd(350),
    primaryFunderId: null,
    organizationId: orgIds.devToolsInc,
    status: "open",
    createdDay: 46,
  }),

  createBounty({
    id: bountyIds.devtoolsColorOutput,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    issueNum: 78,
    title: "Add colored terminal output",
    body: "Add color support for better readability. Should respect NO_COLOR env var.",
    labels: [LABELS.enhancement, LABELS.goodFirstIssue],
    totalFunded: usd(200),
    primaryFunderId: null,
    organizationId: orgIds.devToolsInc,
    status: "open",
    createdDay: 49,
  }),

  createBounty({
    id: bountyIds.devtoolsConfigFile,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    issueNum: 83,
    title: "Support configuration file",
    body: "Read default options from `.devtoolsrc` or `devtools.config.js` file.",
    labels: [LABELS.enhancement],
    totalFunded: usd(450),
    primaryFunderId: null,
    organizationId: orgIds.devToolsInc,
    status: "open",
    createdDay: 51,
  }),

  createBounty({
    id: bountyIds.ossTreeShaking,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    issueNum: 52,
    title: "Enable tree-shaking for all exports",
    body: "Current bundle includes all utilities even when only one is imported. Fix module exports for proper tree-shaking.",
    labels: [LABELS.performance],
    totalFunded: usd(500),
    primaryFunderId: null,
    organizationId: orgIds.openSourceCollective,
    status: "open",
    createdDay: 47,
  }),

  createBounty({
    id: bountyIds.ossTypeDefs,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    issueNum: 58,
    title: "Improve TypeScript type definitions",
    body: "Several utility functions have weak types. Add proper generics and type inference.",
    labels: [LABELS.enhancement, LABELS.documentation],
    totalFunded: usd(300),
    primaryFunderId: null,
    organizationId: orgIds.openSourceCollective,
    status: "open",
    createdDay: 53,
  }),

  createBounty({
    id: bountyIds.liliTempoHooks,
    repoId: repoIds.liliSideProject,
    owner: "lili-chen",
    repo: "tempo-utils",
    issueNum: 12,
    title: "Add React hooks for Tempo blockchain",
    body: "Create React hooks for common Tempo operations: useBalance, useTransfer, usePasskey.",
    labels: [LABELS.enhancement],
    totalFunded: usd(250),
    primaryFunderId: userIds.liliChen,
    organizationId: null,
    status: "open",
    createdDay: 57,
  }),

  createBounty({
    id: bountyIds.acmeApiPagination,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    issueNum: 102,
    title: "Implement cursor-based pagination",
    body: "Replace offset pagination with cursor-based pagination for better performance on large datasets.",
    labels: [LABELS.enhancement, LABELS.performance],
    totalFunded: usd(650),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 43,
  }),

  createBounty({
    id: bountyIds.acmeApiCaching,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    issueNum: 108,
    title: "Add Redis caching layer",
    body: "Implement Redis caching for frequently accessed endpoints to reduce database load.",
    labels: [LABELS.enhancement, LABELS.performance],
    totalFunded: usd(900),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 41,
  }),

  createBounty({
    id: bountyIds.acmeApiWebhooks,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    issueNum: 115,
    title: "Add webhook support for events",
    body: "Allow users to configure webhooks for key events (user signup, payment, etc.).",
    labels: [LABELS.enhancement],
    totalFunded: usd(1100),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "open",
    createdDay: 39,
  }),

  // ========================================
  // Completed Bounties (Historical)
  // ========================================

  createBounty({
    id: bountyIds.acmeLoginBugCompleted,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 98,
    title: "Fix login redirect loop on Safari",
    body: "Users on Safari get stuck in a redirect loop when logging in. Issue is related to SameSite cookie handling.",
    labels: [LABELS.bug],
    totalFunded: usd(500),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "completed",
    createdDay: 10,
    approvedDay: 15,
    paidDay: 16,
  }),

  createBounty({
    id: bountyIds.acmePerformanceCompleted,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 112,
    title: "Optimize bundle size - reduce by 40%",
    body: "Initial bundle is 2.4MB. Target is under 1.5MB through code splitting and dependency optimization.",
    labels: [LABELS.performance],
    totalFunded: usd(1200),
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "completed",
    createdDay: 12,
    approvedDay: 22,
    paidDay: 23,
  }),

  createBounty({
    id: bountyIds.devtoolsVersionCompleted,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    issueNum: 45,
    title: "Add --version flag",
    body: "CLI should display version when run with --version or -v flag.",
    labels: [LABELS.enhancement, LABELS.goodFirstIssue],
    totalFunded: usd(100),
    primaryFunderId: null,
    organizationId: orgIds.devToolsInc,
    status: "completed",
    createdDay: 8,
    approvedDay: 10,
    paidDay: 10,
  }),

  createBounty({
    id: bountyIds.sarahHookCompleted,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    issueNum: 15,
    title: "Add usePrevious hook",
    body: "Hook to get the previous value of a state variable.",
    labels: [LABELS.enhancement, LABELS.goodFirstIssue],
    totalFunded: usd(50),
    primaryFunderId: userIds.sarahMaintainer,
    organizationId: null,
    status: "completed",
    createdDay: 20,
    approvedDay: 26,
    paidDay: 26,
  }),

  createBounty({
    id: bountyIds.ossUtilCompleted,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    issueNum: 32,
    title: "Add deep clone utility",
    body: "Add a performant deep clone function that handles circular references.",
    labels: [LABELS.enhancement],
    totalFunded: usd(200),
    primaryFunderId: null,
    organizationId: orgIds.openSourceCollective,
    status: "completed",
    createdDay: 15,
    approvedDay: 20,
    paidDay: 21,
  }),

  // ========================================
  // Cancelled Bounties
  // ========================================

  createBounty({
    id: bountyIds.acmeLegacyCancelled,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    issueNum: 75,
    title: "Migrate from Redux to Zustand",
    body: "Replace Redux with Zustand for simpler state management. [CANCELLED - decided to keep Redux]",
    labels: [LABELS.enhancement],
    totalFunded: usd(0), // Funds withdrawn
    primaryFunderId: null,
    organizationId: orgIds.acmeLabs,
    status: "cancelled",
    createdDay: 5,
    cancelledDay: 15,
  }),

  createBounty({
    id: bountyIds.devtoolsDeprecatedCancelled,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    issueNum: 38,
    title: "Add Windows GUI wrapper",
    body: "Create a Windows GUI for the CLI tool. [CANCELLED - out of scope]",
    labels: [LABELS.enhancement],
    totalFunded: usd(0),
    primaryFunderId: null,
    organizationId: orgIds.devToolsInc,
    status: "cancelled",
    createdDay: 3,
    cancelledDay: 8,
  }),

  createBounty({
    id: bountyIds.ossAbandonedCancelled,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    issueNum: 18,
    title: "Add GraphQL utilities",
    body: "GraphQL helper functions for common operations. [CANCELLED - maintainer inactive]",
    labels: [LABELS.enhancement],
    totalFunded: usd(0),
    primaryFunderId: null,
    organizationId: orgIds.openSourceCollective,
    status: "cancelled",
    createdDay: 2,
    cancelledDay: 20,
  }),
];
