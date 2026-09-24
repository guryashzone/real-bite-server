import { Inject, Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { LoginAttemptsRepository } from './login-attempts.repository.js';
import {
  DUMMY_PASSWORD_HASH,
  LOGIN_EMAIL_LOCKOUT_THRESHOLD,
  LOGIN_EMAIL_LOCKOUT_WINDOW_MINUTES,
  LOGIN_IP_LOCKOUT_THRESHOLD,
  LOGIN_IP_LOCKOUT_WINDOW_MINUTES,
} from './auth.constants.js';
import {
  AccountLockedException,
  AccountUnavailableException,
  EmailNotVerifiedException,
  InvalidCredentialsException,
} from './auth.errors.js';
import { SessionService, type DeviceInfo, type IssuedTokens } from './session.service.js';
import type { Role } from './decorators/roles.decorator.js';

/**
 * Email + password sign-in (docs/11 §2.3). Every branch — unknown email, no password set (a
 * Google-only account), wrong password — reports the same `InvalidCredentialsException`, so a
 * client can't tell them apart (the enumeration rule).
 */
@Injectable()
export class LoginService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(LoginAttemptsRepository) private readonly attempts: LoginAttemptsRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async login(input: { email: string; password: string }, device: DeviceInfo & { ipHash: string }): Promise<IssuedTokens> {
    const ipCount = await this.attempts.countByIpSince({
      ipHash: device.ipHash,
      sinceMinutesAgo: LOGIN_IP_LOCKOUT_WINDOW_MINUTES,
    });
    if (ipCount >= LOGIN_IP_LOCKOUT_THRESHOLD) {
      await this.attempts.record(input.email, device.ipHash, 'locked');
      throw new AccountLockedException();
    }

    const emailCount = await this.attempts.countSince({
      email: input.email,
      sinceMinutesAgo: LOGIN_EMAIL_LOCKOUT_WINDOW_MINUTES,
    });
    if (emailCount >= LOGIN_EMAIL_LOCKOUT_THRESHOLD) {
      await this.attempts.record(input.email, device.ipHash, 'locked');
      throw new AccountLockedException();
    }

    const user = await this.users.findByEmail(input.email);
    if (!user || !user.passwordHash) {
      // Still pays the Argon2id cost a real wrong-password check would (docs/11 §2.3: register,
      // login and forgot-password must have "the same shape and timing" whether the email exists
      // or not) — verifying against a real user's hash here would leak nothing extra, but skipping
      // the hash entirely is a measurable response-time side channel.
      await this.hasher.verify(DUMMY_PASSWORD_HASH, input.password);
      await this.attempts.record(input.email, device.ipHash, user ? 'bad_password' : 'unknown_email');
      throw new InvalidCredentialsException();
    }

    const valid = await this.hasher.verify(user.passwordHash, input.password);
    if (!valid) {
      await this.attempts.record(input.email, device.ipHash, 'bad_password');
      throw new InvalidCredentialsException();
    }

    if (!user.emailVerified) throw new EmailNotVerifiedException();
    // Re-checked here, not just at refresh time (docs/11 §2.1: "Rejects: suspended and deleted
    // accounts") — a correct password must not still hand out a live session for either.
    if (user.status !== 'active') throw new AccountUnavailableException();

    await this.attempts.record(input.email, device.ipHash, 'success');
    await this.users.touchLastLogin(user.id);

    if (this.hasher.needsRehash(user.passwordHash)) {
      const rehashed = await this.hasher.hash(input.password);
      await this.users.setPasswordHash(user.id, rehashed);
    }

    return this.sessions.issue({ id: user.id, role: user.role as Role, tokenVersion: user.tokenVersion }, device);
  }
}
