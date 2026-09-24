import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { users } from '../common/db/schema/index.js';

export interface UserRow {
  id: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string | null;
  displayName: string;
  role: string;
  status: string;
  tokenVersion: number;
}

const authColumns = {
  id: users.id,
  email: users.email,
  emailVerified: users.emailVerified,
  passwordHash: users.passwordHash,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  tokenVersion: users.tokenVersion,
};

export interface CreateUserInput {
  email: string;
  displayName: string;
  passwordHash?: string | null;
  emailVerified?: boolean;
}

export interface ProfileRow {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  themePref: string;
  role: string;
  status: string;
  createdAt: Date;
}

const profileColumns = {
  id: users.id,
  email: users.email,
  emailVerified: users.emailVerified,
  displayName: users.displayName,
  themePref: users.themePref,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
};

/** Explicit column lists throughout — never a raw `select *` (docs/02 §4.2). */
@Injectable()
export class UsersRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(input: CreateUserInput, tx: Database = this.db): Promise<UserRow> {
    const [row] = await tx
      .insert(users)
      .values({
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash ?? null,
        emailVerified: input.emailVerified ?? false,
      })
      .returning(authColumns);
    if (!row) throw new Error('User insert returned no row');
    return row;
  }

  findByEmail(email: string, tx: Database = this.db): Promise<UserRow | undefined> {
    return tx.select(authColumns).from(users).where(eq(users.email, email)).then((rows) => rows[0]);
  }

  findById(id: string, tx: Database = this.db): Promise<UserRow | undefined> {
    return tx.select(authColumns).from(users).where(eq(users.id, id)).then((rows) => rows[0]);
  }

  async markEmailVerified(userId: string, tx: Database = this.db): Promise<void> {
    await tx.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  }

  async setPasswordHash(userId: string, passwordHash: string, tx: Database = this.db): Promise<void> {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  /** Invalidates every access token already issued, not just future refreshes (docs/11 §2.1). */
  async bumpTokenVersion(userId: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId));
  }

  async touchLastLogin(userId: string, tx: Database = this.db): Promise<void> {
    await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  findProfileById(id: string, tx: Database = this.db): Promise<ProfileRow | undefined> {
    return tx.select(profileColumns).from(users).where(eq(users.id, id)).then((rows) => rows[0]);
  }

  async updateProfile(
    id: string,
    patch: { displayName?: string; themePref?: string },
    tx: Database = this.db,
  ): Promise<void> {
    if (patch.displayName === undefined && patch.themePref === undefined) return;
    await tx.update(users).set(patch).where(eq(users.id, id));
  }

  /** Starts account deletion (docs/11 §4.1): the 30-day purge that tombstones the row is a
   * background job, not built yet — this is only the immediate step. */
  async markDeleted(id: string, tx: Database = this.db): Promise<void> {
    await tx.update(users).set({ status: 'deleted', deletedAt: new Date() }).where(eq(users.id, id));
  }
}
