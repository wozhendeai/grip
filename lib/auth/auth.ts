import { db } from '@/db';
import * as schema from '@/db/schema/auth';
import { signTransactionWithAccessKey } from '@/lib/tempo/keychain-signing';
import { getBackendWalletAddress } from '@/lib/turnkey';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { and, eq } from 'drizzle-orm';
import { getGitHubToken } from '@/lib/github';
import { getUserOrgMembership } from '@/lib/github';
import { syncGitHubMembers } from '@/lib/organization/sync';
import { ac, billingAdmin, bountyManager, member, owner } from './permissions';
import { tempo } from './tempo-plugin/tempo-plugin';
import type { TempoTransactionParams } from './tempo-plugin/types';

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
    schema,
  }),
  experimental: {
    joins: true,
  },

  // GitHub OAuth for identity
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // read:org scope required for organization features
      // Allows reading user's org memberships and org member lists
      scope: ['read:user', 'user:email', 'read:org'],
    },
  },

  plugins: [
    // Passkey (WebAuthn) for wallet creation
    // P-256 only (ES256, algorithm ID -7) for Tempo compatibility
    passkey({
      rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
      rpName: 'GRIP',
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    }),

    // Tempo plugin - derives blockchain address from passkey public key
    // Provides Access Key endpoints for backend signing authorization
    tempo({
      // Turnkey HSM backend wallet for Access Key signing
      backendWallet: {
        provider: 'turnkey',
        getAddress: async (network) => {
          return getBackendWalletAddress(network as 'testnet' | 'mainnet');
        },
        signTransaction: async ({ tx, funderAddress, network }) => {
          // Sign with Turnkey using Access Key authorization
          return signTransactionWithAccessKey({
            tx: tx as TempoTransactionParams,
            funderAddress,
            network: network as 'testnet' | 'mainnet',
          });
        },
      },

      // Enable multi-network support (testnet/mainnet)
      enableNetworkField: true,

      // Allow Tempo testnet only for now
      allowedChainIds: [42429],

      // Default Access Key settings
      accessKeyDefaults: {
        label: 'GRIP Auto-pay',
      },
    }),

    // Organization plugin - multi-user organizations with GitHub linking
    organization({
      ac,
      roles: { owner, billingAdmin, bountyManager, member },

      // Only users with GitHub accounts can create orgs
      // This ensures we can verify ownership of GitHub-linked orgs
      allowUserToCreateOrganization: async (user): Promise<boolean> => {
        // Check if user has connected GitHub account
        // Query database directly since we're server-side
        const githubAccounts = await db
          .select()
          .from(schema.account)
          .where(and(eq(schema.account.userId, user.id), eq(schema.account.providerId, 'github')))
          .limit(1);
        return githubAccounts.length > 0;
      },

      organizationHooks: {
        afterCreateOrganization: async ({ organization, member, user }) => {
          // If GitHub org linked with sync enabled, trigger initial sync
          // This populates the organization with GitHub members on creation
          if (organization.githubOrgId && organization.syncMembership) {
            const token = await getGitHubToken(user.id);
            if (token) {
              try {
                await syncGitHubMembers(organization.id, token);
              } catch (error) {
                console.error('Initial org sync failed:', error);
                // Don't throw - org is created, sync can be retried manually
              }
            }
          }
        },

        beforeAddMember: async ({ member, user, organization }) => {
          // If sync enabled, verify user is member of GitHub org
          // This prevents adding users who aren't in the GitHub org
          if (organization.syncMembership && organization.githubOrgLogin) {
            // Need to get an admin's token to check membership
            // We'll use the current user's token (assumes they have access)
            const token = await getGitHubToken(user.id);
            if (!token) {
              throw new Error('GitHub account required for synced organizations');
            }

            const membership = await getUserOrgMembership(token, organization.githubOrgLogin);
            if (!membership) {
              throw new Error('User is not a member of this GitHub organization');
            }
          }
        },
      },

      schema: {
        user: {
          additionalFields: {
            githubUserId: { type: 'string', required: false },
          },
        },
        organization: {
          additionalFields: {
            githubOrgId: { type: 'string', required: false },
            githubOrgLogin: { type: 'string', required: false },
            syncMembership: { type: 'boolean', defaultValue: false },
            lastSyncedAt: { type: 'date', required: false },
          },
        },
        member: {
          additionalFields: {
            sourceType: { type: 'string', defaultValue: 'manual_invite' },
            githubOrgRole: { type: 'string', required: false },
          },
        },
      },
    }),
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
              'User-Agent': 'GRIP',
            },
          });

          let githubUsername = ctx.context.user.name; // Fallback to current name
          const githubUserId = account.accountId; // GitHub numeric user ID

          if (githubResponse.ok) {
            const githubData = await githubResponse.json();
            githubUsername = githubData.login; // GitHub username (e.g., "john-doe")
          }

          // Store both GitHub username (for URLs) and GitHub user ID (for security verification)
          // githubUserId is used to verify identity when claiming pending payments
          await ctx.context.adapter.update({
            model: 'user',
            where: [{ field: 'id', value: ctx.context.user.id }],
            update: {
              name: githubUsername, // Set to GitHub login, not display name
              githubUserId: BigInt(githubUserId), // Store numeric GitHub user ID for verification
            },
          });
        }
      }
    }),
  },
});
