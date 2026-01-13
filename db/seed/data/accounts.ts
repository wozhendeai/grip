import { stableId, date } from "../_helpers";
import { userIds, githubUserIds } from "./users";

/**
 * Account records linking users to their GitHub OAuth accounts
 *
 * This table is populated by better-auth during OAuth sign-in.
 * We seed it to simulate users who have signed in via GitHub.
 */
export const accounts = Object.entries(userIds).map(([key, userId]) => ({
  id: stableId("account", key),
  accountId: githubUserIds[key as keyof typeof githubUserIds].toString(),
  providerId: "github",
  userId,
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
  scope: "read:user,user:email",
  password: null,
  createdAt: date(0),
  updatedAt: date(0),
}));
