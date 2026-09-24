import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { consents } from '../common/db/schema/index.js';

export interface ConsentRow {
  kind: string;
  version: string;
  grantedAt: Date;
  revokedAt: Date | null;
}

const columns = {
  kind: consents.kind,
  version: consents.version,
  grantedAt: consents.grantedAt,
  revokedAt: consents.revokedAt,
};

@Injectable()
export class ConsentsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /** The live (ungranted-then-revoked never happened) row for this kind, if any. */
  findActive(userId: string, kind: string, tx: Database = this.db): Promise<ConsentRow | undefined> {
    return tx
      .select(columns)
      .from(consents)
      .where(and(eq(consents.userId, userId), eq(consents.kind, kind), isNull(consents.revokedAt)))
      .then((rows) => rows[0]);
  }

  async grant(userId: string, kind: string, version: string, tx: Database = this.db): Promise<void> {
    await tx.insert(consents).values({ userId, kind, version });
  }

  /** Revokes every currently-active row for this kind — there should be at most one, but this
   * doesn't assume it. */
  async revokeActive(userId: string, kind: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(consents)
      .set({ revokedAt: new Date() })
      .where(and(eq(consents.userId, userId), eq(consents.kind, kind), isNull(consents.revokedAt)));
  }
}
