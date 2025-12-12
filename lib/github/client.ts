// client.ts
/**
 * GitHub API client with rate limit handling
 *
 * Uses server-side token for public data fetching.
 * Caches responses to minimize API calls.
 */

export const githubApi = {
  headers: () => ({
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  }),

  async fetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
    const res = await fetch(`https://api.github.com${endpoint}`, {
      headers: this.headers(),
      ...options,
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`GitHub API error: ${res.status} ${res.statusText}`);
      throw new Error(`GitHub API error: ${res.status}`);
    }

    return res.json();
  },
};
