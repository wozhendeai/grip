import { db } from '@/db';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { tempo } from './tempo-plugin';

/**
 * better-auth server configuration
 *
 * Auth flow:
 * 1. GitHub OAuth → establishes identity (user, session, account tables)
 * 2. Passkey registration → creates WebAuthn credential (passkey table)
 * 3. Tempo plugin → derives blockchain address from passkey public key
 *
 * The passkey IS the wallet - no separate wallets table needed.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  // GitHub OAuth for identity
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },

  plugins: [
    // Passkey (WebAuthn) for wallet creation
    // P-256 only (ES256, algorithm ID -7) for Tempo compatibility
    passkey({
      rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      rpName: 'BountyLane',
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    }),

    // Tempo plugin - derives blockchain address from passkey public key
    tempo(),
  ],

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Store GitHub ID and username during OAuth flow
      // IMPORTANT: We store the GitHub LOGIN (username) in user.name, NOT the display name
      // This ensures URLs like /u/[username] work correctly for user lookups
      if (ctx.path === '/callback/github' && ctx.context.user) {
        const account = (await ctx.context.adapter.findOne({
          model: 'account',
          where: [
            { field: 'userId', value: ctx.context.user.id },
            { field: 'providerId', value: 'github' },
          ],
        })) as { accountId: string } | null;

        if (account?.accountId) {
          // Fetch GitHub user data to get the login (username)
          // We need this because better-auth stores profile.name (display name) by default
          // but we want profile.login (username) for routing
          const githubResponse = await fetch(`https://api.github.com/user/${account.accountId}`, {
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              'User-Agent': 'BountyLane',
            },
          });

          let githubUsername = ctx.context.user.name; // Fallback to current name

          if (githubResponse.ok) {
            const githubData = await githubResponse.json();
            githubUsername = githubData.login; // GitHub username (e.g., "john-doe")
          }

          await ctx.context.adapter.update({
            model: 'user',
            where: [{ field: 'id', value: ctx.context.user.id }],
            update: {
              name: githubUsername, // Set to GitHub login, not display name
            },
          });
        }
      }
    }),
  },
});
