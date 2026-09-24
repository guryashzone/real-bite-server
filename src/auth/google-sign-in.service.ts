import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthIdentitiesRepository } from './auth-identities.repository.js';
import { EmailPendingVerificationException } from './auth.errors.js';
import { GOOGLE_TOKEN_VERIFIER, type GoogleTokenVerifier } from './ports/google-token-verifier.port.js';
import { SessionService, type DeviceInfo, type IssuedTokens } from './session.service.js';

const GOOGLE_PROVIDER = 'google';

/**
 * Google Sign-In (docs/11 §2.2, §2.4): verify the ID token server-side, then find-or-create the
 * user. A verified email already owning a password account links to it (one person, one `users`
 * row, many `auth_identities`); an unverified one does not — see `EmailPendingVerificationException`.
 */
@Injectable()
export class GoogleSignInService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuthIdentitiesRepository) private readonly identities: AuthIdentitiesRepository,
    @Inject(GOOGLE_TOKEN_VERIFIER) private readonly verifier: GoogleTokenVerifier,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
  ) {}

  async signIn(idToken: string, device: DeviceInfo): Promise<IssuedTokens> {
    const google = await this.verifier.verify(idToken);

    const existingIdentity = await this.identities.findByProviderSubject(GOOGLE_PROVIDER, google.subject);
    if (existingIdentity) {
      const user = await this.users.findById(existingIdentity.userId);
      if (!user) throw new Error('auth_identities row with no matching user'); // FK-guaranteed; a data bug, not a client error.
      await this.identities.touchLastUsed(existingIdentity.id);
      return this.sessions.issue({ id: user.id, role: 'user', tokenVersion: user.tokenVersion }, device);
    }

    return this.transactions.run(async (tx) => {
      const existingUser = await this.users.findByEmail(google.email, tx);
      if (existingUser) {
        if (!existingUser.emailVerified) throw new EmailPendingVerificationException();
        await this.identities.create(
          { userId: existingUser.id, provider: GOOGLE_PROVIDER, providerSubject: google.subject, email: google.email, emailVerified: true },
          tx,
        );
        return this.sessions.issue({ id: existingUser.id, role: 'user', tokenVersion: existingUser.tokenVersion }, device, tx);
      }

      const user = await this.users.create(
        { email: google.email, displayName: google.name ?? google.email.split('@')[0]!, emailVerified: true },
        tx,
      );
      await this.identities.create(
        { userId: user.id, provider: GOOGLE_PROVIDER, providerSubject: google.subject, email: google.email, emailVerified: true },
        tx,
      );
      return this.sessions.issue({ id: user.id, role: 'user', tokenVersion: user.tokenVersion }, device, tx);
    });
  }
}
