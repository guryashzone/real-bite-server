import { timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { MAIL_SENDER, type MailSender } from './ports/mail-sender.port.js';
import { AuthIdentitiesRepository } from './auth-identities.repository.js';
import { AuthTokensRepository } from './auth-tokens.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import type { Database } from '../common/db/db.types.js';
import { VERIFICATION_CODE_MAX_ATTEMPTS, VERIFICATION_CODE_TTL_MINUTES } from './auth.constants.js';
import { InvalidVerificationCodeException } from './auth.errors.js';
import { SessionService, type DeviceInfo, type IssuedTokens } from './session.service.js';
import { TokenService } from './token.service.js';

const EMAIL_VERIFY_PURPOSE = 'email_verify';

/**
 * The email/password sign-up flow (docs/11 §2.3–2.4): register creates an unverified user and
 * mails a 6-digit code; verify-email spends it and is the point tokens are actually issued.
 * Register, like login and forgot-password, must not reveal whether an email is already taken
 * (docs/11 §2.3 enumeration rule) — a duplicate gets the same response as a fresh signup, and
 * nothing is sent to the address that already owns it.
 */
@Injectable()
export class RegistrationService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuthIdentitiesRepository) private readonly identities: AuthIdentitiesRepository,
    @Inject(AuthTokensRepository) private readonly tokens: AuthTokensRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
  ) {}

  async register(input: { email: string; password: string; displayName: string }): Promise<void> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      // Same (empty) outcome as a fresh signup — but still pays the Argon2id cost a real signup
      // would, discarding the result. docs/11 §2.3 requires "the same shape and timing" whether
      // the email exists or not; skipping the hash here would be a measurable side channel.
      await this.hasher.hash(input.password);
      return;
    }

    const passwordHash = await this.hasher.hash(input.password);
    await this.transactions.run(async (tx) => {
      const user = await this.users.create(
        { email: input.email, displayName: input.displayName, passwordHash, emailVerified: false },
        tx,
      );
      await this.identities.create(
        { userId: user.id, provider: 'password', providerSubject: user.id, email: input.email, emailVerified: false },
        tx,
      );
      await this.issueVerificationCode(user.id, input.email, tx);
    });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerified) return; // Silent: no such account, or nothing to verify.
    await this.issueVerificationCode(user.id, email);
  }

  async verifyEmail(input: { email: string; code: string }, device: DeviceInfo): Promise<IssuedTokens> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new InvalidVerificationCodeException();

    return this.transactions.run(async (tx) => {
      const token = await this.tokens.findLive(user.id, EMAIL_VERIFY_PURPOSE, tx);
      if (!token || token.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
        throw new InvalidVerificationCodeException();
      }

      const matches = safeEqual(this.tokenService.hashCode(input.code), token.codeHash);
      if (!matches) {
        await this.tokens.incrementAttempts(token.id, tx);
        throw new InvalidVerificationCodeException();
      }

      await this.tokens.consume(token.id, tx);
      await this.users.markEmailVerified(user.id, tx);
      return this.sessions.issue({ id: user.id, role: 'user', tokenVersion: user.tokenVersion }, device, tx);
    });
  }

  private async issueVerificationCode(userId: string, email: string, tx?: Database): Promise<void> {
    const { code, hash } = this.tokenService.generateSixDigitCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60_000);
    await this.tokens.create({ userId, purpose: EMAIL_VERIFY_PURPOSE, codeHash: hash, expiresAt }, tx);
    await this.mail.send(
      email,
      'Verify your Real Bite email',
      `Your verification code is ${code}. It expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.`,
    );
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
