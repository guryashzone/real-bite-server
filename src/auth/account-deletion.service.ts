import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthIdentitiesRepository } from './auth-identities.repository.js';
import { SessionService } from './session.service.js';

/**
 * `DELETE /v1/me` — the *immediate* part of docs/11 §4.1 only: `users.status = 'deleted'`,
 * `deleted_at`, every session revoked (which also bumps `token_version`, so an outstanding access
 * token dies at once), and `auth_identities` dropped so the email/Google account can sign up
 * fresh. The 30-day purge (tombstoning the email, deleting pending photos, …) is a background job
 * that doesn't exist yet — not built here.
 *
 * Lives in `auth`, not `users`: it needs `SessionService` and `AuthIdentitiesRepository`, and
 * `users` (layer 2) can't import `auth` (layer 3) without a cycle (docs/02 §4.1).
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuthIdentitiesRepository) private readonly identities: AuthIdentitiesRepository,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
  ) {}

  async deleteAccount(userId: string): Promise<void> {
    await this.transactions.run(async (tx) => {
      await this.users.markDeleted(userId, tx);
      await this.identities.deleteByUserId(userId, tx);
      await this.sessions.revokeAllForUser(userId, tx);
    });
  }
}
