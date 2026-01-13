import { stableId, githubUserId, avatarUrl, date } from "../_helpers";

// Deterministic IDs - same every run for reproducibility
const userIds = {
  // Org admins/owners
  sarahMaintainer: stableId("user", "sarahMaintainer"),
  alexDevops: stableId("user", "alexDevops"),
  acmeAdmin: stableId("user", "acmeAdmin"),
  devtoolsBot: stableId("user", "devtoolsBot"),

  // Active funders
  mikeFunder: stableId("user", "mikeFunder"),
  emmaInvestor: stableId("user", "emmaInvestor"),
  techVentures: stableId("user", "techVentures"),

  // Contributors
  johnContributor: stableId("user", "johnContributor"),
  mariaDev: stableId("user", "mariaDev"),
  openSourceFan: stableId("user", "openSourceFan"),
  firstTimer: stableId("user", "firstTimer"),
  carlosBackend: stableId("user", "carlosBackend"),
  priyaFrontend: stableId("user", "priyaFrontend"),
  davidFullstack: stableId("user", "davidFullstack"),

  // Mixed (fund and contribute)
  liliChen: stableId("user", "liliChen"),
  jamesWilson: stableId("user", "jamesWilson"),

  // Casual users
  newUser: stableId("user", "newUser"),
  lurker: stableId("user", "lurker"),
} as const;

export { userIds };

// GitHub user IDs (stable based on index)
const ghIds = {
  sarahMaintainer: githubUserId(1),
  alexDevops: githubUserId(2),
  acmeAdmin: githubUserId(3),
  devtoolsBot: githubUserId(4),
  mikeFunder: githubUserId(5),
  emmaInvestor: githubUserId(6),
  techVentures: githubUserId(7),
  johnContributor: githubUserId(8),
  mariaDev: githubUserId(9),
  openSourceFan: githubUserId(10),
  firstTimer: githubUserId(11),
  carlosBackend: githubUserId(12),
  priyaFrontend: githubUserId(13),
  davidFullstack: githubUserId(14),
  liliChen: githubUserId(15),
  jamesWilson: githubUserId(16),
  newUser: githubUserId(17),
  lurker: githubUserId(18),
};

export { ghIds as githubUserIds };

export const users = [
  // ===== Org Admins/Maintainers =====
  {
    id: userIds.sarahMaintainer,
    name: "sarah-maintainer",
    email: "sarah@acmelabs.io",
    emailVerified: true,
    image: avatarUrl(ghIds.sarahMaintainer),
    githubUserId: ghIds.sarahMaintainer,
    createdAt: date(0),
    updatedAt: date(0),
  },
  {
    id: userIds.alexDevops,
    name: "alex-devops",
    email: "alex@acmelabs.io",
    emailVerified: true,
    image: avatarUrl(ghIds.alexDevops),
    githubUserId: ghIds.alexDevops,
    createdAt: date(2),
    updatedAt: date(2),
  },
  {
    id: userIds.acmeAdmin,
    name: "acme-admin",
    email: "admin@acmelabs.io",
    emailVerified: true,
    image: avatarUrl(ghIds.acmeAdmin),
    githubUserId: ghIds.acmeAdmin,
    createdAt: date(0),
    updatedAt: date(0),
  },
  {
    id: userIds.devtoolsBot,
    name: "devtools-bot",
    email: "bot@devtools.inc",
    emailVerified: true,
    image: avatarUrl(ghIds.devtoolsBot),
    githubUserId: ghIds.devtoolsBot,
    createdAt: date(5),
    updatedAt: date(5),
  },

  // ===== Primary Funders =====
  {
    id: userIds.mikeFunder,
    name: "mike-funder",
    email: "mike@techventures.vc",
    emailVerified: true,
    image: avatarUrl(ghIds.mikeFunder),
    githubUserId: ghIds.mikeFunder,
    createdAt: date(10),
    updatedAt: date(10),
  },
  {
    id: userIds.emmaInvestor,
    name: "emma-investor",
    email: "emma@opensourcefund.org",
    emailVerified: true,
    image: avatarUrl(ghIds.emmaInvestor),
    githubUserId: ghIds.emmaInvestor,
    createdAt: date(12),
    updatedAt: date(12),
  },
  {
    id: userIds.techVentures,
    name: "tech-ventures-admin",
    email: "grants@techventures.vc",
    emailVerified: true,
    image: avatarUrl(ghIds.techVentures),
    githubUserId: ghIds.techVentures,
    createdAt: date(8),
    updatedAt: date(8),
  },

  // ===== Active Contributors =====
  {
    id: userIds.johnContributor,
    name: "john-contributor",
    email: "john.doe@gmail.com",
    emailVerified: true,
    image: avatarUrl(ghIds.johnContributor),
    githubUserId: ghIds.johnContributor,
    createdAt: date(15),
    updatedAt: date(15),
  },
  {
    id: userIds.mariaDev,
    name: "maria-dev",
    email: "maria.garcia@outlook.com",
    emailVerified: true,
    image: avatarUrl(ghIds.mariaDev),
    githubUserId: ghIds.mariaDev,
    createdAt: date(18),
    updatedAt: date(18),
  },
  {
    id: userIds.openSourceFan,
    name: "opensource-enthusiast",
    email: "oss.fan@proton.me",
    emailVerified: true,
    image: avatarUrl(ghIds.openSourceFan),
    githubUserId: ghIds.openSourceFan,
    createdAt: date(20),
    updatedAt: date(20),
  },
  {
    id: userIds.firstTimer,
    name: "first-timer-123",
    email: "newbie.dev@gmail.com",
    emailVerified: false,
    image: avatarUrl(ghIds.firstTimer),
    githubUserId: ghIds.firstTimer,
    createdAt: date(45),
    updatedAt: date(45),
  },
  {
    id: userIds.carlosBackend,
    name: "carlos-backend",
    email: "carlos.martinez@hey.com",
    emailVerified: true,
    image: avatarUrl(ghIds.carlosBackend),
    githubUserId: ghIds.carlosBackend,
    createdAt: date(22),
    updatedAt: date(22),
  },
  {
    id: userIds.priyaFrontend,
    name: "priya-frontend",
    email: "priya.sharma@gmail.com",
    emailVerified: true,
    image: avatarUrl(ghIds.priyaFrontend),
    githubUserId: ghIds.priyaFrontend,
    createdAt: date(25),
    updatedAt: date(25),
  },
  {
    id: userIds.davidFullstack,
    name: "david-fullstack",
    email: "david.kim@icloud.com",
    emailVerified: true,
    image: avatarUrl(ghIds.davidFullstack),
    githubUserId: ghIds.davidFullstack,
    createdAt: date(28),
    updatedAt: date(28),
  },

  // ===== Mixed (Fund & Contribute) =====
  {
    id: userIds.liliChen,
    name: "lili-chen",
    email: "lili.chen@stripe.com",
    emailVerified: true,
    image: avatarUrl(ghIds.liliChen),
    githubUserId: ghIds.liliChen,
    createdAt: date(5),
    updatedAt: date(5),
  },
  {
    id: userIds.jamesWilson,
    name: "james-wilson",
    email: "james.wilson@vercel.com",
    emailVerified: true,
    image: avatarUrl(ghIds.jamesWilson),
    githubUserId: ghIds.jamesWilson,
    createdAt: date(7),
    updatedAt: date(7),
  },

  // ===== Casual Users =====
  {
    id: userIds.newUser,
    name: "curious-developer",
    email: "curious@example.com",
    emailVerified: false,
    image: avatarUrl(ghIds.newUser),
    githubUserId: ghIds.newUser,
    createdAt: date(55),
    updatedAt: date(55),
  },
  {
    id: userIds.lurker,
    name: "silent-observer",
    email: "observer@example.com",
    emailVerified: false,
    image: null,
    githubUserId: ghIds.lurker,
    createdAt: date(60),
    updatedAt: date(60),
  },
];
