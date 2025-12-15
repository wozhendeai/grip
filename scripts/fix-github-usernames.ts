/**
 * One-time script to fix existing users' GitHub usernames
 *
 * Problem: better-auth stores display name in user.name, but we need GitHub login
 * Solution: Fetch GitHub login from API and update user.name
 *
 * Run with: npx tsx --env-file=.env scripts/fix-github-usernames.ts
 */

import { db } from '@/db';
import { account, user } from '@/db/schema/auth';
import { eq } from 'drizzle-orm';

async function fixGitHubUsernames() {
  console.log('Fetching users with GitHub accounts...');

  // Get all users with GitHub accounts (join with account table)
  const users = await db
    .select({
      userId: user.id,
      userName: user.name,
      githubId: account.accountId,
    })
    .from(user)
    .innerJoin(account, eq(account.userId, user.id))
    .where(eq(account.providerId, 'github'));

  console.log(`Found ${users.length} user(s) with GitHub accounts\n`);

  for (const u of users) {
    console.log(
      `Processing user ${u.userId} (current name: "${u.userName}", GitHub ID: ${u.githubId})`
    );

    try {
      // Fetch GitHub username from API
      const response = await fetch(`https://api.github.com/user/${u.githubId}`, {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'BountyLane',
        },
      });

      if (!response.ok) {
        console.error(
          `  ❌ Failed to fetch GitHub data: ${response.status} ${response.statusText}`
        );
        continue;
      }

      const githubData = await response.json();
      const githubLogin = githubData.login;

      if (u.userName === githubLogin) {
        console.log(`  ✓ Already correct: "${githubLogin}"`);
        continue;
      }

      // Update user.name to GitHub login
      await db.update(user).set({ name: githubLogin }).where(eq(user.id, u.userId));

      console.log(`  ✓ Updated: "${u.userName}" → "${githubLogin}"`);
    } catch (error) {
      console.error('  ❌ Error:', error);
    }
  }

  console.log('\nDone!');
}

fixGitHubUsernames().catch(console.error);
