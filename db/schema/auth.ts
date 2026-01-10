/**
 * better-auth schema with organization plugin and Tempo plugin extension
 *
 * Tables:
 * - user: Identity from GitHub OAuth (stores GitHub login as name, NOT display name)
 * - session: Login sessions with active organization tracking
 * - account: OAuth provider accounts (GitHub OAuth tokens stored here)
 * - passkey: WebAuthn credentials + tempoAddress (Tempo plugin extension)
 * - verification: Email/token verification
 * - organization: Multi-user organizations with optional GitHub linking
 * - member: Organization membership with source tracking (github_sync vs manual_invite)
 * - invitation: Organization invitations
 *
 * IMPORTANT: Auth tables use default timestamp mode to match Better Auth's expectations.
 * Better Auth handles its own JSON serialization for these tables.
 */
import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  varchar,
  index,
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  // Canonical GitHub user ID - must be bigint to handle IDs > 2^53
  githubUserId: bigint('github_user_id', { mode: 'bigint' }).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    activeOrganizationId: text('active_organization_id'),
  },
  (table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const passkey = pgTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    createdAt: timestamp('created_at'),
    aaguid: text('aaguid'),
  },
  (table) => [
    index('passkey_userId_idx').on(table.userId),
    index('passkey_credentialID_idx').on(table.credentialID),
  ]
);

/**
 * Wallet table (Tempo plugin)
 *
 * First-class entity for anything that can sign Tempo transactions:
 * - passkey: User's passkey-derived wallet (P256 curve)
 * - server: Backend wallet (Turnkey HSM, KMS)
 * - external: User's external wallet (MetaMask, WalletConnect, etc.)
 *
 * Replaces the need for tempoAddress on passkey table.
 */
export const walletTypeEnum = ['passkey', 'server', 'external'] as const;
export const keyTypeEnum = ['secp256k1', 'p256', 'webauthn'] as const;

export const wallet = pgTable(
  'wallet',
  {
    id: text('id').primaryKey(),
    address: varchar('address', { length: 42 }).notNull().unique(),
    keyType: varchar('key_type', { length: 20, enum: keyTypeEnum }).notNull(),
    walletType: varchar('wallet_type', { length: 20, enum: walletTypeEnum }).notNull(),
    passkeyId: text('passkey_id')
      .unique()
      .references(() => passkey.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    label: varchar('label', { length: 100 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('wallet_userId_idx').on(table.userId),
    index('wallet_passkeyId_idx').on(table.passkeyId),
    index('wallet_address_idx').on(table.address),
  ]
);

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').notNull(),
  metadata: text('metadata'),
  // GitHub org ID - must be bigint to handle IDs > 2^53
  githubOrgId: bigint('github_org_id', { mode: 'bigint' }).unique(),
  githubOrgLogin: varchar('github_org_login', { length: 39 }),
  syncMembership: boolean('sync_membership').default(false),
  lastSyncedAt: timestamp('last_synced_at'),
});

export const member = pgTable(
  'member',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').default('member').notNull(),
    createdAt: timestamp('created_at').notNull(),
    sourceType: varchar('source_type', { length: 20 }).default('manual_invite'),
    githubOrgRole: varchar('github_org_role', { length: 20 }),
  },
  (table) => [
    index('member_organizationId_idx').on(table.organizationId),
    index('member_userId_idx').on(table.userId),
  ]
);

export const invitation = pgTable(
  'invitation',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role'),
    status: text('status').default('pending').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('invitation_organizationId_idx').on(table.organizationId),
    index('invitation_email_idx').on(table.email),
  ]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
  wallets: many(wallet),
  members: many(member),
  invitations: many(invitation),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
  wallet: one(wallet),
}));

export const walletRelations = relations(wallet, ({ one }) => ({
  user: one(user, {
    fields: [wallet.userId],
    references: [user.id],
  }),
  passkey: one(passkey, {
    fields: [wallet.passkeyId],
    references: [passkey.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

/**
 * Access Key table (Tempo plugin)
 *
 * Stores user authorizations for backend signing via Tempo Access Keys.
 * Managed by better-auth's tempo-plugin adapter.
 *
 * Flow:
 * 1. User signs KeyAuthorization with passkey (granting backend key spending permission)
 * 2. Backend stores authorization proof in this table
 * 3. Backend uses Turnkey-managed secp256k1 key to sign payouts via Keychain signature
 * 4. Tempo validates authorization on-chain via Account Keychain Precompile
 */
export const accessKeyStatuses = ['active', 'revoked', 'expired'] as const;
export type AccessKeyStatus = (typeof accessKeyStatuses)[number];

export const accessKey = pgTable(
  'access_key',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
    rootWalletId: text('root_wallet_id')
      .notNull()
      .references(() => wallet.id, { onDelete: 'restrict' }),
    keyWalletId: text('key_wallet_id')
      .notNull()
      .references(() => wallet.id, { onDelete: 'restrict' }),
    chainId: integer('chain_id').notNull(),
    expiry: integer('expiry'),
    limits: text('limits'),
    authorizationSignature: text('authorization_signature').notNull(),
    authorizationHash: text('authorization_hash').notNull(),
    status: text('status').notNull(),
    label: text('label'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
    organizationId: text('organization_id').references(() => organization.id, {
      onDelete: 'cascade',
    }),
    isDedicated: boolean('is_dedicated').default(false),
    revokedReason: text('revoked_reason'),
    lastUsedAt: timestamp('last_used_at'),
  },
  (table) => [
    index('access_key_userId_idx').on(table.userId),
    index('access_key_rootWalletId_idx').on(table.rootWalletId),
    index('access_key_keyWalletId_idx').on(table.keyWalletId),
    index('access_key_status_idx').on(table.status),
  ]
);

export const accessKeyRelations = relations(accessKey, ({ one }) => ({
  user: one(user, {
    fields: [accessKey.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [accessKey.organizationId],
    references: [organization.id],
  }),
  rootWallet: one(wallet, {
    fields: [accessKey.rootWalletId],
    references: [wallet.id],
  }),
  keyWallet: one(wallet, {
    fields: [accessKey.keyWalletId],
    references: [wallet.id],
  }),
}));
