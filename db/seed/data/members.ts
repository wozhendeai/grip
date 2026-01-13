import { stableId, date } from "../_helpers";
import { userIds } from "./users";
import { orgIds } from "./organizations";

// Member IDs are deterministic based on org+user combination
const memberId = (org: string, user: string) => stableId("member", `${org}:${user}`);

export const members = [
  // ===== Acme Labs Members =====
  {
    id: memberId("acmeLabs", "acmeAdmin"),
    organizationId: orgIds.acmeLabs,
    userId: userIds.acmeAdmin,
    role: "admin",
    createdAt: date(0),
    sourceType: "github_sync" as const,
    githubOrgRole: "admin",
  },
  {
    id: memberId("acmeLabs", "sarahMaintainer"),
    organizationId: orgIds.acmeLabs,
    userId: userIds.sarahMaintainer,
    role: "admin",
    createdAt: date(0),
    sourceType: "github_sync" as const,
    githubOrgRole: "admin",
  },
  {
    id: memberId("acmeLabs", "alexDevops"),
    organizationId: orgIds.acmeLabs,
    userId: userIds.alexDevops,
    role: "member",
    createdAt: date(2),
    sourceType: "github_sync" as const,
    githubOrgRole: "member",
  },
  {
    id: memberId("acmeLabs", "liliChen"),
    organizationId: orgIds.acmeLabs,
    userId: userIds.liliChen,
    role: "member",
    createdAt: date(10),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },

  // ===== DevTools Inc Members =====
  {
    id: memberId("devToolsInc", "devtoolsBot"),
    organizationId: orgIds.devToolsInc,
    userId: userIds.devtoolsBot,
    role: "admin",
    createdAt: date(5),
    sourceType: "github_sync" as const,
    githubOrgRole: "admin",
  },
  {
    id: memberId("devToolsInc", "jamesWilson"),
    organizationId: orgIds.devToolsInc,
    userId: userIds.jamesWilson,
    role: "admin",
    createdAt: date(7),
    sourceType: "github_sync" as const,
    githubOrgRole: "admin",
  },
  {
    id: memberId("devToolsInc", "davidFullstack"),
    organizationId: orgIds.devToolsInc,
    userId: userIds.davidFullstack,
    role: "member",
    createdAt: date(30),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },

  // ===== Open Source Collective Members =====
  {
    id: memberId("openSourceCollective", "emmaInvestor"),
    organizationId: orgIds.openSourceCollective,
    userId: userIds.emmaInvestor,
    role: "admin",
    createdAt: date(10),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },
  {
    id: memberId("openSourceCollective", "mikeFunder"),
    organizationId: orgIds.openSourceCollective,
    userId: userIds.mikeFunder,
    role: "member",
    createdAt: date(15),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },
  {
    id: memberId("openSourceCollective", "techVentures"),
    organizationId: orgIds.openSourceCollective,
    userId: userIds.techVentures,
    role: "member",
    createdAt: date(18),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },

  // ===== Startup XYZ Members =====
  {
    id: memberId("startupXyz", "jamesWilson"),
    organizationId: orgIds.startupXyz,
    userId: userIds.jamesWilson,
    role: "admin",
    createdAt: date(30),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },
  {
    id: memberId("startupXyz", "priyaFrontend"),
    organizationId: orgIds.startupXyz,
    userId: userIds.priyaFrontend,
    role: "member",
    createdAt: date(32),
    sourceType: "manual_invite" as const,
    githubOrgRole: null,
  },
];
