/**
 * Seed script for GRIP (Git Reward & Incentive Platform)
 *
 * Run with: pnpm tsx db/seed/index.ts
 *
 * This script populates the database with realistic mock data
 * demonstrating various platform scenarios:
 *
 * 1. Acme Labs - Active org with many bounties and completed history
 * 2. Multi-funder critical security bounty with $3500+ pool
 * 3. Individual maintainer (Sarah) with small personal bounties
 * 4. Rejected and resubmitted workflow
 * 5. Withdrawn funder scenario
 */

import "dotenv/config";

import { db } from "../index";
import {
  user,
  account,
  organization,
  member,
  tokens,
  repoSettings,
  bounties,
  bountyFunders,
  submissions,
  payouts,
} from "../index";

// Import seed data
import { users } from "./data/users";
import { accounts } from "./data/accounts";
import { organizations } from "./data/organizations";
import { members } from "./data/members";
import { tokens as tokenData } from "./data/tokens";
import { repoSettings as repoSettingsData } from "./data/repo-settings";
import { bounties as bountiesData } from "./data/bounties";
import { bountyFunders as bountyFundersData } from "./data/bounty-funders";
import { submissions as submissionsData } from "./data/submissions";
import { payouts as payoutsData } from "./data/payouts";

async function seed() {
  console.log("🌱 Starting seed...\n");

  try {
    await db.transaction(async (tx) => {
      // Clear existing data in reverse dependency order
      console.log("🗑️  Clearing existing data...");
      await tx.delete(payouts);
      await tx.delete(submissions);
      await tx.delete(bountyFunders);
      await tx.delete(bounties);
      await tx.delete(repoSettings);
      await tx.delete(tokens);
      await tx.delete(member);
      await tx.delete(organization);
      await tx.delete(account);
      await tx.delete(user);
      console.log("   ✓ Existing data cleared\n");

      // Insert data in dependency order
      console.log("📊 Inserting seed data...");

      // 1. Users (no dependencies)
      console.log(`   → Inserting ${users.length} users...`);
      await tx.insert(user).values(users);
      console.log("   ✓ Users inserted");

      // 2. Accounts (depends on users - GitHub OAuth links)
      console.log(`   → Inserting ${accounts.length} accounts...`);
      await tx.insert(account).values(accounts);
      console.log("   ✓ Accounts inserted");

      // 3. Organizations (no dependencies)
      console.log(`   → Inserting ${organizations.length} organizations...`);
      await tx.insert(organization).values(organizations);
      console.log("   ✓ Organizations inserted");

      // 3. Members (depends on users, organizations)
      console.log(`   → Inserting ${members.length} members...`);
      await tx.insert(member).values(members);
      console.log("   ✓ Members inserted");

      // 4. Tokens (no dependencies, use onConflictDoNothing for idempotency)
      console.log(`   → Inserting ${tokenData.length} tokens...`);
      await tx.insert(tokens).values(tokenData).onConflictDoNothing();
      console.log("   ✓ Tokens inserted");

      // 5. Repo Settings (depends on users, organizations)
      console.log(`   → Inserting ${repoSettingsData.length} repo settings...`);
      await tx.insert(repoSettings).values(repoSettingsData);
      console.log("   ✓ Repo settings inserted");

      // 6. Bounties (depends on users, organizations, tokens, repoSettings)
      console.log(`   → Inserting ${bountiesData.length} bounties...`);
      await tx.insert(bounties).values(bountiesData);
      console.log("   ✓ Bounties inserted");

      // 7. Bounty Funders (depends on bounties, users, organizations)
      console.log(`   → Inserting ${bountyFundersData.length} bounty funders...`);
      await tx.insert(bountyFunders).values(bountyFundersData);
      console.log("   ✓ Bounty funders inserted");

      // 8. Submissions (depends on bounties, users)
      console.log(`   → Inserting ${submissionsData.length} submissions...`);
      await tx.insert(submissions).values(submissionsData);
      console.log("   ✓ Submissions inserted");

      // 9. Payouts (depends on submissions, bounties, users)
      console.log(`   → Inserting ${payoutsData.length} payouts...`);
      await tx.insert(payouts).values(payoutsData);
      console.log("   ✓ Payouts inserted");
    });

    console.log("\n✅ Seed completed successfully!");
    console.log("\n📈 Summary:");
    console.log(`   • ${users.length} users`);
    console.log(`   • ${accounts.length} accounts`);
    console.log(`   • ${organizations.length} organizations`);
    console.log(`   • ${members.length} members`);
    console.log(`   • ${tokenData.length} tokens`);
    console.log(`   • ${repoSettingsData.length} repositories`);
    console.log(`   • ${bountiesData.length} bounties`);
    console.log(`   • ${bountyFundersData.length} funding commitments`);
    console.log(`   • ${submissionsData.length} submissions`);
    console.log(`   • ${payoutsData.length} payouts`);
  } catch (error) {
    console.error("\n❌ Seed failed:", error);
    throw error;
  }
}

// Run if executed directly
seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
