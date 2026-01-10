import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from 'better-auth/plugins/organization/access';

/**
 * Grip Access Control System
 *
 * Custom roles for organization permissions:
 * - owner: Full control (org deletion, ownership transfer, all operations)
 * - billingAdmin: Wallet management only (no bounty access)
 * - bountyManager: Bounty operations only (no wallet access)
 * - member: View-only access
 *
 * Design decision: Separates financial operations (billing_admin) from
 * bounty management (bounty_manager) to prevent privilege escalation.
 *
 * Example usage:
 *   const canApproveBounty = await auth.api.hasPermission({
 *     headers,
 *     body: { permissions: { bounty: ['approve'] } }
 *   });
 */

// Define Grip-specific resources and actions
// Extends Better Auth defaults (organization, member, invitation)
// We add 'read' to member for explicit membership checks via hasPermission
const statement = {
  ...defaultStatements,
  member: ['read', 'create', 'update', 'delete'],
  bounty: ['create', 'update', 'approve', 'cancel'],
  wallet: ['view', 'fund', 'withdraw'],
  reports: ['view', 'export'],
} as const;

export const ac = createAccessControl(statement);

/**
 * Owner Role
 * Full control over all resources:
 * - Organization: update, delete
 * - Members: create, update, delete
 * - Invitations: create, cancel
 * - Bounties: create, update, approve, cancel
 * - Wallet: view, fund, withdraw
 * - Reports: view, export
 */
export const owner = ac.newRole({
  ...ownerAc.statements, // Inherit Better Auth owner permissions
  member: ['read', 'create', 'update', 'delete'],
  bounty: ['create', 'update', 'approve', 'cancel'],
  wallet: ['view', 'fund', 'withdraw'],
  reports: ['view', 'export'],
});

/**
 * Billing Admin Role
 * Wallet management only, NO bounty access
 * - Organization: read-only (inherited from memberAc)
 * - Members: read-only
 * - Wallet: view, fund, withdraw
 * - Reports: view, export
 * - Bounties: NO permissions (intentionally omitted)
 */
export const billingAdmin = ac.newRole({
  ...memberAc.statements, // Base member permissions (read-only org/members)
  member: ['read'],
  wallet: ['view', 'fund', 'withdraw'],
  reports: ['view', 'export'],
  // NO bounty permissions - this is intentional
});

/**
 * Bounty Manager Role
 * Bounty operations only, NO wallet access
 * - Organization: read-only (inherited from memberAc)
 * - Members: read-only
 * - Bounties: create, update, approve, cancel
 * - Wallet: NO permissions (intentionally omitted)
 */
export const bountyManager = ac.newRole({
  ...memberAc.statements, // Base member permissions
  member: ['read'],
  bounty: ['create', 'update', 'approve', 'cancel'],
  // NO wallet permissions - this is intentional
});

/**
 * Member Role
 * View-only access to organization data
 * - Organization: read-only
 * - Members: read-only
 * - NO bounty permissions
 * - NO wallet permissions
 */
export const member = ac.newRole({
  ...memberAc.statements, // Only default read permissions
  member: ['read'], // Explicit read permission for membership checks
});
