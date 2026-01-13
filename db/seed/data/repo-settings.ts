import { githubRepoId, dateStr } from "../_helpers";
import { userIds } from "./users";
import { orgIds } from "./organizations";

// Stable repo IDs for referencing
const repoIds = {
  acmeWebapp: githubRepoId(1),
  acmeApi: githubRepoId(2),
  devtoolsCli: githubRepoId(3),
  ossLibrary: githubRepoId(4),
  sarahPersonal: githubRepoId(5),
  liliSideProject: githubRepoId(6),
} as const;

export { repoIds };

export const repoSettings = [
  // ===== Acme Labs Repos =====
  // Main webapp - org-owned, high activity, auto-pay enabled
  {
    githubRepoId: repoIds.acmeWebapp,
    githubOwner: "acme-labs",
    githubRepo: "webapp",
    requireOwnerApproval: true,
    verifiedOwnerUserId: null,
    verifiedOwnerOrganizationId: orgIds.acmeLabs,
    verifiedAt: dateStr(1),
    webhookId: null,
    webhookSecret: null,
    installationId: BigInt(12345678),
    autoPayEnabled: true,
    autoPayAccessKeyId: null, // Would be set when access key is created
    defaultExpirationDays: 30,
    contributorEligibility: "anyone" as const,
    showAmountsPublicly: true,
    emailOnSubmission: true,
    emailOnMerge: true,
    emailOnPaymentFailure: true,
    onboardingCompleted: true,
    createdAt: dateStr(0),
    updatedAt: dateStr(50),
  },

  // API service - org-owned, moderate activity
  {
    githubRepoId: repoIds.acmeApi,
    githubOwner: "acme-labs",
    githubRepo: "api",
    requireOwnerApproval: true,
    verifiedOwnerUserId: null,
    verifiedOwnerOrganizationId: orgIds.acmeLabs,
    verifiedAt: dateStr(3),
    webhookId: null,
    webhookSecret: null,
    installationId: BigInt(12345678),
    autoPayEnabled: false,
    autoPayAccessKeyId: null,
    defaultExpirationDays: null,
    contributorEligibility: "collaborators" as const,
    showAmountsPublicly: true,
    emailOnSubmission: true,
    emailOnMerge: true,
    emailOnPaymentFailure: true,
    onboardingCompleted: true,
    createdAt: dateStr(3),
    updatedAt: dateStr(45),
  },

  // ===== DevTools Inc Repos =====
  // CLI tool - org-owned
  {
    githubRepoId: repoIds.devtoolsCli,
    githubOwner: "devtools-inc",
    githubRepo: "cli",
    requireOwnerApproval: false,
    verifiedOwnerUserId: null,
    verifiedOwnerOrganizationId: orgIds.devToolsInc,
    verifiedAt: dateStr(6),
    webhookId: null,
    webhookSecret: null,
    installationId: BigInt(23456789),
    autoPayEnabled: false,
    autoPayAccessKeyId: null,
    defaultExpirationDays: 14,
    contributorEligibility: "anyone" as const,
    showAmountsPublicly: true,
    emailOnSubmission: true,
    emailOnMerge: true,
    emailOnPaymentFailure: true,
    onboardingCompleted: true,
    createdAt: dateStr(5),
    updatedAt: dateStr(40),
  },

  // ===== Community Repos =====
  // OSS library - community owned via collective
  {
    githubRepoId: repoIds.ossLibrary,
    githubOwner: "oss-collective",
    githubRepo: "shared-utils",
    requireOwnerApproval: false,
    verifiedOwnerUserId: null,
    verifiedOwnerOrganizationId: orgIds.openSourceCollective,
    verifiedAt: dateStr(12),
    webhookId: null,
    webhookSecret: null,
    installationId: BigInt(34567890),
    autoPayEnabled: false,
    autoPayAccessKeyId: null,
    defaultExpirationDays: null,
    contributorEligibility: "anyone" as const,
    showAmountsPublicly: true,
    emailOnSubmission: false,
    emailOnMerge: true,
    emailOnPaymentFailure: true,
    onboardingCompleted: true,
    createdAt: dateStr(10),
    updatedAt: dateStr(35),
  },

  // ===== Individual Repos =====
  // Sarah's personal project - Scenario 3: Individual maintainer
  {
    githubRepoId: repoIds.sarahPersonal,
    githubOwner: "sarah-maintainer",
    githubRepo: "react-hooks-collection",
    requireOwnerApproval: false,
    verifiedOwnerUserId: userIds.sarahMaintainer,
    verifiedOwnerOrganizationId: null,
    verifiedAt: dateStr(20),
    webhookId: null,
    webhookSecret: null,
    installationId: BigInt(45678901),
    autoPayEnabled: false,
    autoPayAccessKeyId: null,
    defaultExpirationDays: null,
    contributorEligibility: "anyone" as const,
    showAmountsPublicly: true,
    emailOnSubmission: true,
    emailOnMerge: true,
    emailOnPaymentFailure: true,
    onboardingCompleted: true,
    createdAt: dateStr(18),
    updatedAt: dateStr(30),
  },

  // Lili's side project - individual, minimal setup
  {
    githubRepoId: repoIds.liliSideProject,
    githubOwner: "lili-chen",
    githubRepo: "tempo-utils",
    requireOwnerApproval: false,
    verifiedOwnerUserId: userIds.liliChen,
    verifiedOwnerOrganizationId: null,
    verifiedAt: dateStr(25),
    webhookId: null,
    webhookSecret: null,
    installationId: BigInt(56789012),
    autoPayEnabled: false,
    autoPayAccessKeyId: null,
    defaultExpirationDays: null,
    contributorEligibility: "anyone" as const,
    showAmountsPublicly: false, // Private amounts
    emailOnSubmission: true,
    emailOnMerge: true,
    emailOnPaymentFailure: true,
    onboardingCompleted: false, // Onboarding not completed
    createdAt: dateStr(24),
    updatedAt: dateStr(24),
  },
];
