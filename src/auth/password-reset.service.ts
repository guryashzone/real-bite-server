import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthTokensRepository } from './auth-tokens.repository.js';
import { VERIFICATION_CODE_MAX_ATTEMPTS, VERIFICATION_CODE_TTL_MINUTES } from './auth.constants.js';
import { InvalidVerificationCodeException } from './auth.errors.js';
import { MAIL_SENDER, type MailSender } from './ports/mail-sender.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { safeEqual } from './safe-equal.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

const PASSWORD_RESET_PURPOSE = 'password_reset';

/**
 * Forgot/reset password (docs/11 §2.3). `forgotPassword` always answers the same way whether or
 * not the email exists (enumeration rule) and never says so out loud; `resetPassword` spends a
 * 6-digit code, exactly like email verification, and then revokes every session for the account —
 * a reset is as strong a "prove you're the owner" signal as a fresh sign-in.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(AuthTokensRepository) private readonly tokens: AuthTokensRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
  ) {}

  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return; // Same (empty) outcome as a real account — no enumeration signal.

    const { code, hash } = this.tokenService.generateSixDigitCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60_000);
    await this.tokens.create({ userId: user.id, purpose: PASSWORD_RESET_PURPOSE, codeHash: hash, expiresAt });
    await this.mail.send(
      email,
      'Reset your Real Bite password',
      `Your password reset code is ${code}. It expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`,
    );
  }

  async resetPassword(input: { email: string; code: string; newPassword: string }): Promise<void> {
    const user = await this.users.findByEmail(input.email);
    if (!user) throw new InvalidVerificationCodeException();

    const passwordHash = await this.hasher.hash(input.newPassword);

    await this.transactions.run(async (tx) => {
      const token = await this.tokens.findLive(user.id, PASSWORD_RESET_PURPOSE, tx);
      if (!token || token.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
        throw new InvalidVerificationCodeException();
      }

      const matches = safeEqual(this.tokenService.hashCode(input.code), token.codeHash);
      if (!matches) {
        await this.tokens.incrementAttempts(token.id, tx);
        throw new InvalidVerificationCodeException();
      }

      await this.tokens.consume(token.id, tx);
      await this.users.setPasswordHash(user.id, passwordHash, tx);
      await this.sessions.revokeAllForUser(user.id, tx);
    });
  }
}
