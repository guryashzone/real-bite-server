import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { authSessions, users } from '../common/db/schema/index.js';

export interface AuthSessionRow {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  rotatedTo: string | null;
  rotatedAt: Date | null;
  replays: number;
}

const sessionColumns = {
  id: authSessions.id,
  userId: authSessions.userId,
  refreshTokenHash: authSessions.refreshTokenHash,
  expiresAt: authSessions.expiresAt,
  revokedAt: authSessions.revokedAt,
  rotatedTo: authSessions.rotatedTo,
  rotatedAt: authSessions.rotatedAt,
  replays: authSessions.replays,
};

export interface NewSession {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  platform?: string | null;
  appVersion?: string | null;
  deviceLabel?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

/** What `AuthGuard` needs from the `sid`/`sub` pair in one indexed query (docs/11 §2.1). */
export interface GuardContextRow {
  sessionId: string;
  sessionRevokedAt: Date | null;
  sessionExpiresAt: Date;
  userId: string;
  userStatus: string;
  userRole: string;
  userTokenVersion: number;
}

@Injectable()
export class AuthSessionsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(input: NewSession, tx: Database = this.db): Promise<AuthSessionRow> {
    const [row] = await tx
      .insert(authSessions)
      .values({
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        platform: input.platform ?? null,
        appVersion: input.appVersion ?? null,
        deviceLabel: input.deviceLabel ?? null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        lastUsedAt: new Date(),
      })
      .returning(sessionColumns);
    if (!row) throw new Error('Auth session insert returned no row');
    return row;
  }

  /** Locks the row so two simultaneous refreshes on the same token serialize (docs/11 §2.1). */
  findForRotation(refreshTokenHash: string, tx: Database = this.db): Promise<AuthSessionRow | undefined> {
    return tx
      .select(sessionColumns)
      .from(authSessions)
      .where(eq(authSessions.refreshTokenHash, refreshTokenHash))
      .for('update')
      .then((rows) => rows[0]);
  }

  /** Same lock, by primary key — used to inspect a rotation's successor by `rotated_to`. */
  findByIdForUpdate(id: string, tx: Database = this.db): Promise<AuthSessionRow | undefined> {
    return tx
      .select(sessionColumns)
      .from(authSessions)
      .where(eq(authSessions.id, id))
      .for('update')
      .then((rows) => rows[0]);
  }

  async markRotated(id: string, rotatedToId: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(authSessions)
      .set({ rotatedTo: rotatedToId, rotatedAt: new Date() })
      .where(eq(authSessions.id, id));
  }

  async incrementReplays(id: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(authSessions)
      .set({ replays: sql`${authSessions.replays} + 1`, lastUsedAt: new Date() })
      .where(eq(authSessions.id, id));
  }

  async revoke(id: string, tx: Database = this.db): Promise<void> {
    await tx.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, id));
  }

  /** Revokes every live session for a user — logout-everywhere and password reset (docs/11 §2.3). */
  async revokeAllForUser(userId: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }

  findGuardContext(sessionId: string, userId: string, tx: Database = this.db): Promise<GuardContextRow | undefined> {
    return tx
      .select({
        sessionId: authSessions.id,
        sessionRevokedAt: authSessions.revokedAt,
        sessionExpiresAt: authSessions.expiresAt,
        userId: users.id,
        userStatus: users.status,
        userRole: users.role,
        userTokenVersion: users.tokenVersion,
      })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)))
      .then((rows) => rows[0]);
  }
}
