import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { loginAttempts } from '../common/db/schema/index.js';

export type LoginOutcome = 'success' | 'bad_password' | 'unknown_email' | 'locked';

@Injectable()
export class LoginAttemptsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async record(email: string | null, ipHash: string, outcome: LoginOutcome, tx: Database = this.db): Promise<void> {
    await tx.insert(loginAttempts).values({ email, ipHash, outcome });
  }

  async countSince(
    filter: { email: string; sinceMinutesAgo: number },
    tx: Database = this.db,
  ): Promise<number> {
    const since = new Date(Date.now() - filter.sinceMinutesAgo * 60_000);
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.email, filter.email), gte(loginAttempts.createdAt, since)));
    return row?.count ?? 0;
  }

  async countByIpSince(
    filter: { ipHash: string; sinceMinutesAgo: number },
    tx: Database = this.db,
  ): Promise<number> {
    const since = new Date(Date.now() - filter.sinceMinutesAgo * 60_000);
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ipHash, filter.ipHash), gte(loginAttempts.createdAt, since)));
    return row?.count ?? 0;
  }
}
