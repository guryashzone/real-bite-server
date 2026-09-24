import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '../common/db/db.types.js';
import { AuthTokensRepository } from './auth-tokens.repository.js';
import { VERIFICATION_CODE_MAX_ATTEMPTS } from './auth.constants.js';
import { safeEqual } from './safe-equal.js';
import { TokenService } from './token.service.js';

export type VerifyCodeResult = 'ok' | 'invalid';

/**
 * The 6-digit-code verify step shared by email verification and password reset (docs/11 §2.3):
 * find the live code for this purpose, cap wrong guesses at `VERIFICATION_CODE_MAX_ATTEMPTS`,
 * compare in constant time, and consume it on success. Both callers run this inside their own
 * transaction and do whatever the successful verification unlocks (issue a session, set a new
 * password) in the same `tx`.
 *
 * Returns a result instead of throwing on a wrong/expired code: the "wrong guess" case still has
 * to write the incremented attempt count, and a write followed by a throw *out of the same
 * transaction* gets rolled back with everything else in it — the exact bug the refresh-token
 * theft path had (session.service.ts). Callers must check the result and throw
 * `InvalidVerificationCodeException` themselves, *after* their transaction has committed.
 */
@Injectable()
export class VerificationCodeService {
  constructor(
    @Inject(AuthTokensRepository) private readonly tokens: AuthTokensRepository,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  async verifyAndConsume(userId: string, purpose: string, code: string, tx: Database): Promise<VerifyCodeResult> {
    const token = await this.tokens.findLive(userId, purpose, tx);
    if (!token || token.attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
      return 'invalid';
    }

    const matches = safeEqual(this.tokenService.hashCode(code), token.codeHash);
    if (!matches) {
      await this.tokens.incrementAttempts(token.id, tx);
      return 'invalid';
    }

    await this.tokens.consume(token.id, tx);
    return 'ok';
  }
}
