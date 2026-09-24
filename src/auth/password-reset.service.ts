import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthTokensRepository } from './auth-tokens.repository.js';
import { VERIFICATION_CODE_TTL_MINUTES } from './auth.constants.js';
import { InvalidVerificationCodeException } from './auth.errors.js';
import { MAIL_SENDER, type MailSender } from './ports/mail-sender.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { VerificationCodeService } from './verification-code.service.js';

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
    @Inject(VerificationCodeService) private readonly verificationCodes: VerificationCodeService,
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

    // Same reason as RegistrationService.verifyEmail: a wrong code's incremented attempt count
    // must commit, so this resolves to a result rather than throwing out of the transaction.
    const result = await this.transactions.run(async (tx) => {
      const outcome = await this.verificationCodes.verifyAndConsume(user.id, PASSWORD_RESET_PURPOSE, input.code, tx);
      if (outcome === 'invalid') return outcome;

      // Hashed only after the code checks out, not before: a wrong guess (capped at
      // VERIFICATION_CODE_MAX_ATTEMPTS per code) no longer pays for an Argon2id hash of a
      // password it's about to throw away.
      const passwordHash = await this.hasher.hash(input.newPassword);
      await this.users.setPasswordHash(user.id, passwordHash, tx);
      await this.sessions.revokeAllForUser(user.id, tx);
      return outcome;
    });

    if (result === 'invalid') throw new InvalidVerificationCodeException();
  }
}
