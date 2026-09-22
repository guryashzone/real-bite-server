import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { citext } from './types.js';

/**
 * A person, once (docs/11 §3.1). Sign-in methods hang off `auth_identities`; sessions off
 * `auth_sessions` (both arrive with the auth endpoints), so this table carries no provider detail
 * beyond `password_hash`.
 *
 * There is deliberately **no home-city column**: where a user is lives in `user_locations`
 * (docs/12 §2.3), because it has a source and a confidence and there can be more than one.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Case-insensitive; the one identity a person is matched on when accounts link (docs/11 §2.4). */
    email: citext('email').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    /** Argon2id encoded string. Null means Google-only: there is no password to check. */
    passwordHash: text('password_hash'),
    displayName: text('display_name').notNull(),
    /**
     * Points at `media_assets`; the foreign key is added with that table. Nothing writes this
     * before then.
     */
    avatarAssetId: uuid('avatar_asset_id'),
    /** Read from the database on every authenticated request, never from the token (docs/11 §2.1). */
    role: text('role').notNull().default('user'),
    themePref: text('theme_pref').notNull().default('system'),
    status: text('status').notNull().default('active'),
    /** Bumped by a password reset or "sign out everywhere"; tokens carrying an older value die. */
    tokenVersion: integer('token_version').notNull().default(0),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    unique('users_email_key').on(table.email),
    check('users_role_check', sql`${table.role} in ('user', 'moderator', 'admin')`),
    check('users_status_check', sql`${table.status} in ('active', 'suspended', 'deleted')`),
    check('users_theme_pref_check', sql`${table.themePref} in ('system', 'light', 'dark')`),
  ],
);
