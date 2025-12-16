export * from './repo-settings';
export * from './bounties';
export * from './submissions';
export * from './payouts';
export * from './passkeys';
export * from './users';

// Backwards compatibility aliases (Session 1 → Session 2 migration)
// These allow incremental migration without breaking all imports at once
export {
  getRepoSettingsByName as getProjectByRepo,
  getRepoSettingsByGithubRepoId as getProjectById,
  getUserReposWithStats as getUserProjectsWithStats,
  isUserRepoOwner as canUserManageProject,
} from './repo-settings';

export { getSubmissionsByBounty as getClaimsByBounty } from './submissions';
