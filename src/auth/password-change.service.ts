import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthIdentitiesRepository } from './auth-identities.repository.js';
import { InvalidCredentialsException, PasswordRequiredException } from './auth.errors.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';

/**
 * `POST /v1/auth/password/change` (docs/11 §4): the one password endpoint that requires being
 * signed in already, so it also covers setting a first password on a Google-only account
 * (`passwordHash` null) — there `currentPassword` is neither required nor checked.
 */
@Injectable()
export class PasswordChangeService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuthIdentitiesRepository) private readonly identities: AuthIdentitiesRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
  ) {}

  async change(userId: string, input: { currentPassword?: string; newPassword: string }): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new InvalidCredentialsException();

    if (user.passwordHash) {
      if (!input.currentPassword) throw new PasswordRequiredException();
      const valid = await this.hasher.verify(user.passwordHash, input.currentPassword);
      if (!valid) throw new InvalidCredentialsException();
    }

    const newHash = await this.hasher.hash(input.newPassword);
    await this.transactions.run(async (tx) => {
      await this.users.setPasswordHash(userId, newHash, tx);
      // A Google-only account setting its first password gets a `password` identity too, so it can
      // subsequently sign in either way (docs/11 §2.4: one user, many auth_identities).
      const existing = await this.identities.findByUserAndProvider(userId, 'password', tx);
      if (!existing) {
        await this.identities.create(
          { userId, provider: 'password', providerSubject: userId, email: user.email, emailVerified: user.emailVerified },
          tx,
        );
      }
    });
  }
}
