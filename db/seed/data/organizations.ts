import { stableId, githubOrgId, date } from "../_helpers";

// Deterministic IDs - same every run for reproducibility
const orgIds = {
  acmeLabs: stableId("org", "acmeLabs"),
  devToolsInc: stableId("org", "devToolsInc"),
  openSourceCollective: stableId("org", "openSourceCollective"),
  startupXyz: stableId("org", "startupXyz"),
} as const;

export { orgIds };

// GitHub org IDs (stable based on index)
const ghOrgIds = {
  acmeLabs: githubOrgId(1),
  devToolsInc: githubOrgId(2),
  openSourceCollective: githubOrgId(3),
  startupXyz: null, // Manual org, not GitHub-synced
};

export { ghOrgIds as githubOrgIds };

export const organizations = [
  // Acme Labs - Primary demo org with active bounty program
  {
    id: orgIds.acmeLabs,
    name: "Acme Labs",
    slug: "acme-labs",
    logo: "https://avatars.githubusercontent.com/u/1054321",
    createdAt: date(0),
    metadata: JSON.stringify({
      website: "https://acmelabs.io",
      description: "Building the future of developer tools",
    }),
    githubOrgId: ghOrgIds.acmeLabs,
    githubOrgLogin: "acme-labs",
    syncMembership: true,
    lastSyncedAt: date(50),
    visibility: "public" as const,
  },

  // DevTools Inc - Secondary org with moderate activity
  {
    id: orgIds.devToolsInc,
    name: "DevTools Inc",
    slug: "devtools-inc",
    logo: "https://avatars.githubusercontent.com/u/2054321",
    createdAt: date(5),
    metadata: JSON.stringify({
      website: "https://devtools.inc",
      description: "CLI tools for modern developers",
    }),
    githubOrgId: ghOrgIds.devToolsInc,
    githubOrgLogin: "devtools-inc",
    syncMembership: true,
    lastSyncedAt: date(48),
    visibility: "public" as const,
  },

  // Open Source Collective - Community-driven org
  {
    id: orgIds.openSourceCollective,
    name: "Open Source Collective",
    slug: "oss-collective",
    logo: "https://avatars.githubusercontent.com/u/3054321",
    createdAt: date(10),
    metadata: JSON.stringify({
      website: "https://osscollective.org",
      description: "Funding open source one bounty at a time",
    }),
    githubOrgId: ghOrgIds.openSourceCollective,
    githubOrgLogin: "oss-collective",
    syncMembership: false,
    lastSyncedAt: null,
    visibility: "members_only" as const,
  },

  // Startup XYZ - Manual org (no GitHub sync)
  {
    id: orgIds.startupXyz,
    name: "Startup XYZ",
    slug: "startup-xyz",
    logo: null,
    createdAt: date(30),
    metadata: null,
    githubOrgId: null,
    githubOrgLogin: null,
    syncMembership: false,
    lastSyncedAt: null,
    visibility: "private" as const,
  },
];
