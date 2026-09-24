import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { authTokens } from '../common/db/schema/index.js';

export interface AuthTokenRow {
  id: string;
  userId: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

const columns = {
  id: authTokens.id,
  userId: authTokens.userId,
  purpose: authTokens.purpose,
  codeHash: authTokens.codeHash,
  attempts: authTokens.attempts,
  expiresAt: authTokens.expiresAt,
  consumedAt: authTokens.consumedAt,
};

@Injectable()
export class AuthTokensRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(
    input: { userId: string; purpose: string; codeHash: string; expiresAt: Date },
    tx: Database = this.db,
  ): Promise<AuthTokenRow> {
    const [row] = await tx.insert(authTokens).values(input).returning(columns);
    if (!row) throw new Error('Auth token insert returned no row');
    return row;
  }

  /** The newest live (unexpired, unconsumed) code for this user and purpose. */
  findLive(userId: string, purpose: string, tx: Database = this.db): Promise<AuthTokenRow | undefined> {
    return tx
      .select(columns)
      .from(authTokens)
      .where(
        and(
          eq(authTokens.userId, userId),
          eq(authTokens.purpose, purpose),
          isNull(authTokens.consumedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .orderBy(sql`${authTokens.createdAt} desc`)
      .limit(1)
      .then((rows) => rows[0]);
  }

  async incrementAttempts(id: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(authTokens)
      .set({ attempts: sql`${authTokens.attempts} + 1` })
      .where(eq(authTokens.id, id));
  }

  async consume(id: string, tx: Database = this.db): Promise<void> {
    await tx.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, id));
  }
}
