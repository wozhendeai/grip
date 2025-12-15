import { bigint, boolean, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * better-auth schema with Tempo plugin extension
 *
 * Tables:
 * - user: Identity from GitHub OAuth
 * - session: Login sessions
 * - account: OAuth provider accounts
 * - passkey: WebAuthn credentials + tempoAddress (Tempo plugin extension)
 *
 * IMPORTANT: All timestamp columns use mode: 'string' to return ISO 8601 strings
 * instead of Date objects. This ensures JSON serialization works correctly for
 * React Server Components without manual conversion in every query.
 */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'),
  // Canonical GitHub user ID (populated from account.accountId where providerId='github')
  // Used for GitHub-related operations and canonical references
  // BigInt mode to handle GitHub IDs that may exceed 2^53
  githubUserId: bigint('github_user_id', { mode: 'bigint' }).unique(),
  // mode: 'string' returns ISO 8601 strings instead of Date objects
  // This ensures JSON serialization works for React Server Components
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString()),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString()),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { mode: 'string' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { mode: 'string' }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date().toISOString()),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' })
    .defaultNow()
    .$onUpdate(() => new Date().toISOString()),
});

/**
 * Passkey table - extended by Tempo plugin
 *
 * The tempoAddress field is populated after passkey registration
 * by deriving the address from the P256 public key:
 *   tempoAddress = '0x' + keccak256(x || y).slice(-40)
 */
export const passkey = pgTable('passkey', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  credentialID: text('credential_id').notNull().unique(),
  counter: integer('counter').default(0),
  deviceType: text('device_type'),
  backedUp: boolean('backed_up').default(false),
  transports: text('transports'),
  aaguid: text('aaguid'),

  // TEMPO PLUGIN EXTENSION
  // Derived from P256 public key: keccak256(x || y).slice(-40)
  tempoAddress: varchar('tempo_address', { length: 42 }).unique(),

  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});
