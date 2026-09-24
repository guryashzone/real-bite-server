import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { authIdentities } from '../common/db/schema/index.js';

export interface AuthIdentityRow {
  id: string;
  userId: string;
  provider: string;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
}

const columns = {
  id: authIdentities.id,
  userId: authIdentities.userId,
  provider: authIdentities.provider,
  providerSubject: authIdentities.providerSubject,
  email: authIdentities.email,
  emailVerified: authIdentities.emailVerified,
};

@Injectable()
export class AuthIdentitiesRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(
    input: { userId: string; provider: string; providerSubject: string; email?: string | null; emailVerified?: boolean },
    tx: Database = this.db,
  ): Promise<AuthIdentityRow> {
    const [row] = await tx
      .insert(authIdentities)
      .values({
        userId: input.userId,
        provider: input.provider,
        providerSubject: input.providerSubject,
        email: input.email ?? null,
        emailVerified: input.emailVerified ?? false,
      })
      .returning(columns);
    if (!row) throw new Error('Auth identity insert returned no row');
    return row;
  }

  findByProviderSubject(
    provider: string,
    providerSubject: string,
    tx: Database = this.db,
  ): Promise<AuthIdentityRow | undefined> {
    return tx
      .select(columns)
      .from(authIdentities)
      .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerSubject, providerSubject)))
      .then((rows) => rows[0]);
  }

  findByUserAndProvider(userId: string, provider: string, tx: Database = this.db): Promise<AuthIdentityRow | undefined> {
    return tx
      .select(columns)
      .from(authIdentities)
      .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, provider)))
      .then((rows) => rows[0]);
  }

  async touchLastUsed(id: string, tx: Database = this.db): Promise<void> {
    await tx.update(authIdentities).set({ lastUsedAt: new Date() }).where(eq(authIdentities.id, id));
  }
}
