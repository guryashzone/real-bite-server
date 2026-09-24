import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { citext } from './types.js';
import { users } from './users.js';

/**
 * How a person can sign in. One `users` row, many identities (docs/11 §2.4, §3.1): Google is
 * linked by `provider_subject` (Google's `sub`), and email + password gets a `password` row whose
 * `provider_subject` is that user's own id — there is no other natural key for a password
 * identity, and `unique(provider, provider_subject)` still holds one row per user per provider.
 */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    email: citext('email'),
    emailVerified: boolean('email_verified').notNull().default(false),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    unique('auth_identities_provider_subject_key').on(table.provider, table.providerSubject),
    index('auth_identities_user').on(table.userId),
    check('auth_identities_provider_check', sql`${table.provider} in ('google', 'password')`),
  ],
);

/**
 * One row per refresh token (docs/11 §2.1, §3.1). The access token is a stateless 15-minute JWT
 * and is never stored; only the refresh side needs a row, because only it can be revoked, rotated
 * or replayed. `rotated_at` and `replays` drive the 60-second reuse grace window; `rotated_to`
 * chains a session to the row its rotation produced, so a theft revokes the whole chain.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    rotatedTo: uuid('rotated_to'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    replays: smallint('replays').notNull().default(0),
    platform: text('platform'),
    appVersion: text('app_version'),
    deviceLabel: text('device_label'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    unique('auth_sessions_refresh_token_hash_key').on(table.refreshTokenHash),
    // Live sessions for a user (logout-everywhere, the reuse-detection lookup).
    index('auth_sessions_user_live')
      .on(table.userId)
      .where(sql`${table.revokedAt} is null`),
  ],
);

/** Short-lived 6-digit codes for email verification and password reset (docs/11 §2.3, §3.1). */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    purpose: text('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: smallint('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('auth_tokens_user_purpose').on(table.userId, table.purpose),
    check('auth_tokens_purpose_check', sql`${table.purpose} in ('email_verify', 'password_reset')`),
  ],
);

/**
 * Every login attempt, successful or not (docs/11 §2.3, §3.1) — the source of truth for the
 * lockout rule (5 failed/email/15 min, 20/IP/hour). `email` is nullable so a malformed request
 * with no email still records an IP-side attempt. Pruned after 30 days by a background job.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    email: citext('email'),
    ipHash: text('ip_hash').notNull(),
    outcome: text('outcome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('login_attempts_email_created').on(table.email, table.createdAt),
    index('login_attempts_ip_created').on(table.ipHash, table.createdAt),
    check(
      'login_attempts_outcome_check',
      sql`${table.outcome} in ('success', 'bad_password', 'unknown_email', 'locked')`,
    ),
  ],
);

/** A version-stamped grant or revocation (docs/11 §3.1). Kept after account deletion (§4.1) to
 * prove consent was given — pointing at a tombstoned user, never a person. */
export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    version: text('version').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('consents_user').on(table.userId),
    check(
      'consents_kind_check',
      sql`${table.kind} in ('terms', 'privacy', 'photo_display', 'photo_commercial', 'photo_training', 'location')`,
    ),
  ],
);
