import { githubApi } from './client';

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  html_url: string;
  blog: string | null;
  location: string | null;
  twitter_username: string | null;
};

/**
 * GitHub Event from Events API (simplified)
 */
type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
};

/**
 * Activity level based on recent contributions
 */
export type ActivityLevel = 'active' | 'recent' | 'inactive';

/**
 * GitHub user activity summary
 */
export type GitHubActivity = {
  lastActiveAt: string | null; // ISO timestamp of last public event
  activityLevel: ActivityLevel;
};

/**
 * Fetch GitHub user profile by username
 *
 * Caches for 1 hour since user profiles don't change frequently.
 * Returns null if user doesn't exist.
 */
export async function fetchGitHubUser(username: string): Promise<GitHubUser | null> {
  return githubApi.fetch<GitHubUser>(`/users/${username}`, {
    next: { revalidate: 3600 }, // Cache 1 hour
  });
}

/**
 * Fetch GitHub user activity to determine if they're an active contributor
 *
 * Fetches recent public events to show credibility signals.
 * Filters out passive events (WatchEvent, ForkEvent) that don't indicate real contributions.
 *
 * Activity levels:
 * - active: < 7 days since last activity
 * - recent: 7-30 days since last activity
 * - inactive: > 30 days or no events
 *
 * Caches for 1 hour to minimize API requests while staying reasonably fresh.
 */
export async function fetchGitHubUserActivity(username: string): Promise<GitHubActivity> {
  try {
    // Fetch recent public events (max 30 to ensure we find a real contribution)
    // Filter out passive events that don't indicate real activity
    const events = await githubApi.fetch<GitHubEvent[]>(
      `/users/${username}/events/public?per_page=30`,
      {
        next: { revalidate: 3600 }, // Cache 1 hour
      }
    );

    if (!events || events.length === 0) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

    // Filter out passive events (WatchEvent = starring repos, ForkEvent = forking without contribution)
    // Keep events that indicate real activity: PushEvent, PullRequestEvent, IssuesEvent, etc.
    const activeEvents = events.filter(
      (event) => event.type !== 'WatchEvent' && event.type !== 'ForkEvent'
    );

    if (activeEvents.length === 0) {
      return { lastActiveAt: null, activityLevel: 'inactive' };
    }

    // Get most recent active event
    const lastEvent = activeEvents[0];
    const lastActiveAt = lastEvent.created_at;

    // Calculate activity level based on recency
    const now = new Date();
    const lastActiveDate = new Date(lastActiveAt);
    const diffInDays = Math.floor(
      (now.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    let activityLevel: ActivityLevel;
    if (diffInDays < 7) {
      activityLevel = 'active';
    } else if (diffInDays < 30) {
      activityLevel = 'recent';
    } else {
      activityLevel = 'inactive';
    }

    return { lastActiveAt, activityLevel };
  } catch (error) {
    // Graceful degradation on error (rate limits, API issues)
    // Return inactive instead of throwing - profile page should still render
    console.error('Failed to fetch GitHub activity:', error);
    return { lastActiveAt: null, activityLevel: 'inactive' };
  }
}
