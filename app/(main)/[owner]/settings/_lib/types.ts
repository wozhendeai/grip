/**
 * Shared types for organization settings
 * Extracted from org-settings-layout.tsx for reuse across routes
 */

export type OrgRole = 'owner' | 'billingAdmin' | 'bountyManager' | 'member';

export interface OrgMemberWallet {
  id: string;
  address: string;
  walletType: 'passkey' | 'server' | 'external';
}

export interface OrgMember {
  id: string;
  role: string;
  sourceType: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    wallets?: OrgMemberWallet[];
  } | null;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: OrgRole;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  expiresAt: Date;
  inviterId: string;
}

export interface OrgAccessKey {
  id: string;
  organizationId: string | null;
  chainId: number;
  rootWalletId: string;
  keyWalletId: string;
  keyType: string | null;
  expiry: string | null; // Unix timestamp as string (JSON can't serialize bigint)
  limits: unknown;
  status: string;
  createdAt: Date | string | null;
  label: string | null;
  user: {
    id: string;
    name: string | null;
  } | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  githubOrgLogin: string | null;
  syncMembership: boolean | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
}

export interface OrgSettingsContext {
  organization: Organization;
  currentUserRole: OrgRole;
  isOwner: boolean;
  canViewWallet: boolean;
  canManageMembers: boolean;
  hasGitHubSync: boolean;
}
