import { stableUuid, githubPrId, dateStr } from "../_helpers";
import { userIds, githubUserIds } from "./users";
import { bountyIds } from "./bounties";
import { repoIds } from "./repo-settings";
import type { SubmissionStatus } from "../_helpers";

// Deterministic submission IDs - same every run for reproducibility
const submissionIds = {
  // Completed bounties - paid submissions
  loginBugPaid: stableUuid("submission", "loginBugPaid"),
  performancePaid: stableUuid("submission", "performancePaid"),
  versionPaid: stableUuid("submission", "versionPaid"),
  hookPaid: stableUuid("submission", "hookPaid"),
  utilPaid: stableUuid("submission", "utilPaid"),

  // Merged submissions (pending payout)
  securityMerged: stableUuid("submission", "securityMerged"),

  // Approved submissions
  dashboardApproved: stableUuid("submission", "dashboardApproved"),
  cliRefactorApproved: stableUuid("submission", "cliRefactorApproved"),

  // Pending submissions
  websocketPending1: stableUuid("submission", "websocketPending1"),
  websocketPending2: stableUuid("submission", "websocketPending2"),
  oauthPending: stableUuid("submission", "oauthPending"),
  typescriptPending: stableUuid("submission", "typescriptPending"),
  darkModePending: stableUuid("submission", "darkModePending"),
  csvExportPending: stableUuid("submission", "csvExportPending"),
  mobilePending: stableUuid("submission", "mobilePending"),
  apiDocsPending: stableUuid("submission", "apiDocsPending"),
  autocompletesPending: stableUuid("submission", "autocompletesPending"),
  colorOutputPending: stableUuid("submission", "colorOutputPending"),
  configFilePending: stableUuid("submission", "configFilePending"),
  treeShakingPending: stableUuid("submission", "treeShakingPending"),
  typeDefsPending: stableUuid("submission", "typeDefsPending"),
  tempoHooksPending: stableUuid("submission", "tempoHooksPending"),
  paginationPending: stableUuid("submission", "paginationPending"),
  cachingPending: stableUuid("submission", "cachingPending"),
  webhooksPending: stableUuid("submission", "webhooksPending"),

  // Rejected submissions
  cliRefactorRejected: stableUuid("submission", "cliRefactorRejected"),
  validationRejected: stableUuid("submission", "validationRejected"),
  debounceRejected: stableUuid("submission", "debounceRejected"),

  // Additional submissions for variety
  rateLimitPending: stableUuid("submission", "rateLimitPending"),
  testCoveragePending: stableUuid("submission", "testCoveragePending"),
  localStoragePending: stableUuid("submission", "localStoragePending"),
  documentationPending: stableUuid("submission", "documentationPending"),
} as const;

export { submissionIds };

// Helper to create submission
interface SubmissionInput {
  id: string;
  bountyId: string;
  userId: string;
  repoId: bigint;
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  status: SubmissionStatus;
  submittedDay: number;
  funderApprovedDay?: number;
  funderApprovedBy?: string;
  ownerApprovedDay?: number;
  ownerApprovedBy?: string;
  rejectedDay?: number;
  rejectedBy?: string;
  rejectionNote?: string;
  mergedDay?: number;
  closedDay?: number;
}

function createSubmission(input: SubmissionInput) {
  const repoSeed = Number(input.repoId % BigInt(1000));
  const ghUserId = Object.entries(githubUserIds).find(
    ([key]) => userIds[key as keyof typeof userIds] === input.userId
  )?.[1];

  return {
    id: input.id,
    bountyId: input.bountyId,
    userId: input.userId,
    githubUserId: ghUserId ?? null,
    githubPrId: githubPrId(repoSeed, input.prNumber),
    githubPrNumber: input.prNumber,
    githubPrUrl: `https://github.com/${input.owner}/${input.repo}/pull/${input.prNumber}`,
    githubPrTitle: input.prTitle,
    status: input.status,
    funderApprovedAt: input.funderApprovedDay ? dateStr(input.funderApprovedDay) : null,
    funderApprovedBy: input.funderApprovedBy ?? null,
    ownerApprovedAt: input.ownerApprovedDay ? dateStr(input.ownerApprovedDay) : null,
    ownerApprovedBy: input.ownerApprovedBy ?? null,
    rejectedAt: input.rejectedDay ? dateStr(input.rejectedDay) : null,
    rejectedBy: input.rejectedBy ?? null,
    rejectionNote: input.rejectionNote ?? null,
    prMergedAt: input.mergedDay ? dateStr(input.mergedDay) : null,
    prClosedAt: input.closedDay ? dateStr(input.closedDay) : null,
    submittedAt: dateStr(input.submittedDay),
    createdAt: dateStr(input.submittedDay),
    updatedAt: dateStr(input.mergedDay ?? input.rejectedDay ?? input.funderApprovedDay ?? input.submittedDay),
  };
}

export const submissions = [
  // ========================================
  // PAID SUBMISSIONS (completed bounties)
  // Status: "paid"
  // ========================================

  createSubmission({
    id: submissionIds.loginBugPaid,
    bountyId: bountyIds.acmeLoginBugCompleted,
    userId: userIds.johnContributor,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 99,
    prTitle: "fix: resolve Safari login redirect loop",
    status: "paid",
    submittedDay: 12,
    funderApprovedDay: 14,
    funderApprovedBy: userIds.sarahMaintainer,
    ownerApprovedDay: 14,
    ownerApprovedBy: userIds.sarahMaintainer,
    mergedDay: 15,
  }),

  createSubmission({
    id: submissionIds.performancePaid,
    bountyId: bountyIds.acmePerformanceCompleted,
    userId: userIds.carlosBackend,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 118,
    prTitle: "perf: optimize bundle size with code splitting and lazy loading",
    status: "paid",
    submittedDay: 18,
    funderApprovedDay: 21,
    funderApprovedBy: userIds.alexDevops,
    ownerApprovedDay: 21,
    ownerApprovedBy: userIds.alexDevops,
    mergedDay: 22,
  }),

  createSubmission({
    id: submissionIds.versionPaid,
    bountyId: bountyIds.devtoolsVersionCompleted,
    userId: userIds.firstTimer,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    prNumber: 46,
    prTitle: "feat: add --version flag to display CLI version",
    status: "paid",
    submittedDay: 9,
    funderApprovedDay: 9,
    funderApprovedBy: userIds.devtoolsBot,
    mergedDay: 10,
  }),

  createSubmission({
    id: submissionIds.hookPaid,
    bountyId: bountyIds.sarahHookCompleted,
    userId: userIds.mariaDev,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    prNumber: 16,
    prTitle: "feat: add usePrevious hook with TypeScript support",
    status: "paid",
    submittedDay: 23,
    funderApprovedDay: 25,
    funderApprovedBy: userIds.sarahMaintainer,
    mergedDay: 26,
  }),

  createSubmission({
    id: submissionIds.utilPaid,
    bountyId: bountyIds.ossUtilCompleted,
    userId: userIds.davidFullstack,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    prNumber: 33,
    prTitle: "feat: add deepClone utility with circular reference handling",
    status: "paid",
    submittedDay: 17,
    funderApprovedDay: 19,
    funderApprovedBy: userIds.emmaInvestor,
    mergedDay: 20,
  }),

  // ========================================
  // MERGED SUBMISSIONS (awaiting payout)
  // Status: "merged"
  // ========================================

  createSubmission({
    id: submissionIds.securityMerged,
    bountyId: bountyIds.acmeCriticalSecurity,
    userId: userIds.carlosBackend,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 152,
    prTitle: "fix: prevent SQL injection in search endpoint with parameterized queries",
    status: "merged",
    submittedDay: 36,
    funderApprovedDay: 38,
    funderApprovedBy: userIds.sarahMaintainer,
    ownerApprovedDay: 38,
    ownerApprovedBy: userIds.sarahMaintainer,
    mergedDay: 40,
  }),

  // ========================================
  // APPROVED SUBMISSIONS (awaiting merge)
  // Status: "approved"
  // ========================================

  createSubmission({
    id: submissionIds.dashboardApproved,
    bountyId: bountyIds.acmeDashboard,
    userId: userIds.priyaFrontend,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 168,
    prTitle: "perf: implement virtualization for dashboard list rendering",
    status: "approved",
    submittedDay: 48,
    funderApprovedDay: 52,
    funderApprovedBy: userIds.alexDevops,
    ownerApprovedDay: 52,
    ownerApprovedBy: userIds.alexDevops,
  }),

  createSubmission({
    id: submissionIds.cliRefactorApproved,
    bountyId: bountyIds.devtoolsCliRefactor,
    userId: userIds.davidFullstack,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    prNumber: 71,
    prTitle: "refactor: implement subcommand architecture for CLI",
    status: "approved",
    submittedDay: 45,
    funderApprovedDay: 50,
    funderApprovedBy: userIds.jamesWilson,
  }),

  // ========================================
  // PENDING SUBMISSIONS
  // Status: "pending"
  // ========================================

  // Multiple submissions on high-value bounty
  createSubmission({
    id: submissionIds.websocketPending1,
    bountyId: bountyIds.acmeWebsocket,
    userId: userIds.johnContributor,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 145,
    prTitle: "fix: cleanup WebSocket connections on client disconnect",
    status: "pending",
    submittedDay: 42,
  }),

  createSubmission({
    id: submissionIds.websocketPending2,
    bountyId: bountyIds.acmeWebsocket,
    userId: userIds.carlosBackend,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 148,
    prTitle: "fix: implement proper WebSocket lifecycle management with WeakMap",
    status: "pending",
    submittedDay: 44,
  }),

  createSubmission({
    id: submissionIds.oauthPending,
    bountyId: bountyIds.acmeOauth,
    userId: userIds.mariaDev,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 162,
    prTitle: "feat: add generic OAuth provider configuration",
    status: "pending",
    submittedDay: 50,
  }),

  createSubmission({
    id: submissionIds.typescriptPending,
    bountyId: bountyIds.acmeTypescript,
    userId: userIds.firstTimer,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 175,
    prTitle: "chore: fix TypeScript strict mode errors in auth module",
    status: "pending",
    submittedDay: 52,
  }),

  createSubmission({
    id: submissionIds.darkModePending,
    bountyId: bountyIds.acmeDarkMode,
    userId: userIds.priyaFrontend,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 182,
    prTitle: "feat(ui): implement dark mode with system preference detection",
    status: "pending",
    submittedDay: 54,
  }),

  createSubmission({
    id: submissionIds.csvExportPending,
    bountyId: bountyIds.acmeCsvExport,
    userId: userIds.openSourceFan,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 188,
    prTitle: "feat: add CSV export for analytics with date filtering",
    status: "pending",
    submittedDay: 55,
  }),

  createSubmission({
    id: submissionIds.mobilePending,
    bountyId: bountyIds.acmeMobileLayout,
    userId: userIds.firstTimer,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 195,
    prTitle: "fix: responsive layout for profile page on mobile",
    status: "pending",
    submittedDay: 56,
  }),

  createSubmission({
    id: submissionIds.apiDocsPending,
    bountyId: bountyIds.acmeApiDocs,
    userId: userIds.davidFullstack,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    prNumber: 97,
    prTitle: "docs: add OpenAPI 3.0 specification for all endpoints",
    status: "pending",
    submittedDay: 51,
  }),

  createSubmission({
    id: submissionIds.autocompletesPending,
    bountyId: bountyIds.devtoolsAutoComplete,
    userId: userIds.carlosBackend,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    prNumber: 75,
    prTitle: "feat: add shell completion scripts for bash, zsh, fish",
    status: "pending",
    submittedDay: 53,
  }),

  createSubmission({
    id: submissionIds.colorOutputPending,
    bountyId: bountyIds.devtoolsColorOutput,
    userId: userIds.firstTimer,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    prNumber: 80,
    prTitle: "feat: add ANSI color support with NO_COLOR handling",
    status: "pending",
    submittedDay: 54,
  }),

  createSubmission({
    id: submissionIds.configFilePending,
    bountyId: bountyIds.devtoolsConfigFile,
    userId: userIds.johnContributor,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    prNumber: 85,
    prTitle: "feat: read config from .devtoolsrc file",
    status: "pending",
    submittedDay: 55,
  }),

  createSubmission({
    id: submissionIds.treeShakingPending,
    bountyId: bountyIds.ossTreeShaking,
    userId: userIds.carlosBackend,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    prNumber: 54,
    prTitle: "perf: enable tree-shaking with ESM exports",
    status: "pending",
    submittedDay: 52,
  }),

  createSubmission({
    id: submissionIds.typeDefsPending,
    bountyId: bountyIds.ossTypeDefs,
    userId: userIds.mariaDev,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    prNumber: 60,
    prTitle: "types: improve TypeScript generics for utility functions",
    status: "pending",
    submittedDay: 56,
  }),

  createSubmission({
    id: submissionIds.tempoHooksPending,
    bountyId: bountyIds.liliTempoHooks,
    userId: userIds.openSourceFan,
    repoId: repoIds.liliSideProject,
    owner: "lili-chen",
    repo: "tempo-utils",
    prNumber: 14,
    prTitle: "feat: add useBalance and useTransfer hooks for Tempo",
    status: "pending",
    submittedDay: 58,
  }),

  createSubmission({
    id: submissionIds.paginationPending,
    bountyId: bountyIds.acmeApiPagination,
    userId: userIds.davidFullstack,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    prNumber: 105,
    prTitle: "feat: implement cursor-based pagination",
    status: "pending",
    submittedDay: 49,
  }),

  createSubmission({
    id: submissionIds.cachingPending,
    bountyId: bountyIds.acmeApiCaching,
    userId: userIds.carlosBackend,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    prNumber: 112,
    prTitle: "perf: add Redis caching layer for hot endpoints",
    status: "pending",
    submittedDay: 48,
  }),

  createSubmission({
    id: submissionIds.webhooksPending,
    bountyId: bountyIds.acmeApiWebhooks,
    userId: userIds.johnContributor,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    prNumber: 118,
    prTitle: "feat: add webhook configuration and event dispatch",
    status: "pending",
    submittedDay: 47,
  }),

  // ========================================
  // REJECTED SUBMISSIONS
  // Status: "rejected"
  // ========================================

  // Scenario 4: First submission rejected, resubmitted by different person
  createSubmission({
    id: submissionIds.cliRefactorRejected,
    bountyId: bountyIds.devtoolsCliRefactor,
    userId: userIds.openSourceFan,
    repoId: repoIds.devtoolsCli,
    owner: "devtools-inc",
    repo: "cli",
    prNumber: 68,
    prTitle: "refactor: add subcommand support",
    status: "rejected",
    submittedDay: 38,
    rejectedDay: 42,
    rejectedBy: userIds.jamesWilson,
    rejectionNote: "Implementation doesn't handle nested subcommands correctly. The 'config set' command fails when key contains dots. Please review the spec for subcommand parsing rules.",
    closedDay: 42,
  }),

  createSubmission({
    id: submissionIds.validationRejected,
    bountyId: bountyIds.ossValidation,
    userId: userIds.firstTimer,
    repoId: repoIds.ossLibrary,
    owner: "oss-collective",
    repo: "shared-utils",
    prNumber: 47,
    prTitle: "feat: add schema validation",
    status: "rejected",
    submittedDay: 30,
    rejectedDay: 35,
    rejectedBy: userIds.emmaInvestor,
    rejectionNote: "Bundle size is too large (50KB). The goal is to be much smaller than Zod. Please consider using a more minimal approach without pulling in all of ajv.",
    closedDay: 35,
  }),

  createSubmission({
    id: submissionIds.debounceRejected,
    bountyId: bountyIds.sarahUseDebounce,
    userId: userIds.newUser,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    prNumber: 24,
    prTitle: "add debounce hook",
    status: "rejected",
    submittedDay: 56,
    rejectedDay: 57,
    rejectedBy: userIds.sarahMaintainer,
    rejectionNote: "Missing TypeScript types and cleanup function doesn't cancel pending timeout. Please add proper typing and handle component unmount.",
    closedDay: 57,
  }),

  // ========================================
  // Additional pending submissions for active bounties
  // ========================================

  createSubmission({
    id: submissionIds.rateLimitPending,
    bountyId: bountyIds.acmeRateLimiting,
    userId: userIds.mariaDev,
    repoId: repoIds.acmeApi,
    owner: "acme-labs",
    repo: "api",
    prNumber: 92,
    prTitle: "fix: implement proper per-IP rate limiting with Redis",
    status: "pending",
    submittedDay: 45,
  }),

  createSubmission({
    id: submissionIds.testCoveragePending,
    bountyId: bountyIds.acmeTestCoverage,
    userId: userIds.davidFullstack,
    repoId: repoIds.acmeWebapp,
    owner: "acme-labs",
    repo: "webapp",
    prNumber: 202,
    prTitle: "test: add unit and integration tests to reach 80% coverage",
    status: "pending",
    submittedDay: 57,
  }),

  createSubmission({
    id: submissionIds.localStoragePending,
    bountyId: bountyIds.sarahUseLocalStorage,
    userId: userIds.priyaFrontend,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    prNumber: 30,
    prTitle: "feat: add useLocalStorage hook with SSR support",
    status: "pending",
    submittedDay: 58,
  }),

  createSubmission({
    id: submissionIds.documentationPending,
    bountyId: bountyIds.sarahDocumentation,
    userId: userIds.openSourceFan,
    repoId: repoIds.sarahPersonal,
    owner: "sarah-maintainer",
    repo: "react-hooks-collection",
    prNumber: 32,
    prTitle: "docs: improve README with usage examples for all hooks",
    status: "pending",
    submittedDay: 59,
  }),
];
