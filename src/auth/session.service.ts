import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import type { Database } from '../common/db/db.types.js';
import { PinoLogger } from '../common/logging/index.js';
import { AuditLogsRepository } from '../audit/audit-logs.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthSessionsRepository, type AuthSessionRow } from './auth-sessions.repository.js';
import { REFRESH_REPLAY_GRACE_MS, REFRESH_REPLAY_MAX } from './auth.constants.js';
import { AccountUnavailableException, SessionRevokedException } from './auth.errors.js';
import { TokenService } from './token.service.js';
import type { Role } from './decorators/roles.decorator.js';

export interface DeviceInfo {
  platform?: string | null;
  appVersion?: string | null;
  deviceLabel?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionUser {
  id: string;
  role: Role;
  tokenVersion: number;
}

type RotateResult = { kind: 'issued'; tokens: IssuedTokens } | { kind: 'theft' };

/**
 * Session issuance and refresh-token rotation (docs/11 §2.1). Owns every transaction that touches
 * `auth_sessions`: `issue` (a new sign-in), `rotate` (the `/v1/auth/refresh` flow, including reuse
 * detection) and the revoke helpers used by logout, password reset and account deletion.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(AuthSessionsRepository) private readonly sessions: AuthSessionsRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
    @Inject(AuditLogsRepository) private readonly audit: AuditLogsRepository,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionService.name);
  }

  /** New sign-in: Google, register, or login. */
  async issue(user: SessionUser, device: DeviceInfo, tx?: Database): Promise<IssuedTokens> {
    const run = (t: Database) => this.issueWithin(user, device, t);
    return tx ? run(tx) : this.transactions.run(run);
  }

  private async issueWithin(user: SessionUser, device: DeviceInfo, tx: Database): Promise<IssuedTokens> {
    const refresh = this.tokens.generateRefreshToken();
    const session = await this.sessions.create(
      { userId: user.id, refreshTokenHash: refresh.hash, expiresAt: refresh.expiresAt, ...device },
      tx,
    );
    const accessToken = this.tokens.signAccessToken({ sub: user.id, sid: session.id, ver: user.tokenVersion });
    return { accessToken, refreshToken: refresh.raw };
  }

  /**
   * `/v1/auth/refresh`. Locks the presented row `FOR UPDATE` so concurrent refreshes on the same
   * token serialize, then judges a token that was already rotated by when and how often it comes
   * back (docs/11 §2.1's grace-window table).
   *
   * Theft revokes every session the user has — writes that must survive the request that detected
   * them. So this never *throws* out of the middle of the transaction (a thrown error rolls back
   * everything written so far, silently undoing the revocation); it returns a `{ kind: 'theft' }`
   * result instead, lets the transaction commit normally, and only then raises the error.
   */
  async rotate(rawRefreshToken: string, device: DeviceInfo): Promise<IssuedTokens> {
    const hash = this.tokens.hashRefreshToken(rawRefreshToken);
    const result = await this.transactions.run<RotateResult>(async (tx) => {
      const session = await this.sessions.findForRotation(hash, tx);
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        // Nothing written yet at this point, so throwing here has nothing to roll back.
        throw new SessionRevokedException();
      }

      if (session.rotatedTo) {
        return this.handleReplay(session, device, tx);
      }

      return { kind: 'issued', tokens: await this.rotateFresh(session, device, tx) };
    });

    if (result.kind === 'theft') throw new SessionRevokedException();
    return result.tokens;
  }

  private async rotateFresh(session: AuthSessionRow, device: DeviceInfo, tx: Database): Promise<IssuedTokens> {
    // Read fresh, not carried from the presented token: a suspension or "sign out everywhere"
    // must block the very next refresh, not just the next access-token check (docs/11 §2.1).
    const user = await this.users.findById(session.userId, tx);
    if (!user || user.status !== 'active') throw new AccountUnavailableException();

    const refresh = this.tokens.generateRefreshToken();
    const next = await this.sessions.create(
      { userId: session.userId, refreshTokenHash: refresh.hash, expiresAt: refresh.expiresAt, ...device },
      tx,
    );
    await this.sessions.markRotated(session.id, next.id, tx);
    const accessToken = this.tokens.signAccessToken({ sub: session.userId, sid: next.id, ver: user.tokenVersion });
    return { accessToken, refreshToken: refresh.raw };
  }

  /**
   * The presented token was already rotated once. A narrow grace window absorbs a dropped
   * response or a double refresh without punishing normal concurrency (docs/11 §2.1); anything
   * outside it is treated as theft and revokes every session the user has.
   */
  private async handleReplay(session: AuthSessionRow, device: DeviceInfo, tx: Database): Promise<RotateResult> {
    const successor = session.rotatedTo ? await this.sessions.findByIdForUpdate(session.rotatedTo, tx) : undefined;
    const rotatedAt = session.rotatedAt?.getTime() ?? 0;
    const withinGrace = Date.now() - rotatedAt < REFRESH_REPLAY_GRACE_MS;
    const successorUnused = successor !== undefined && successor.rotatedTo === null;

    if (withinGrace && successorUnused && session.replays < REFRESH_REPLAY_MAX) {
      await this.sessions.incrementReplays(session.id, tx);
      await this.audit.record(
        {
          actorUserId: session.userId,
          action: 'auth.refresh_replay',
          entityType: 'auth_session',
          entityId: session.id,
          ipHash: device.ipHash,
        },
        tx,
      );
      // The original successor was never delivered to the client, so it's safe to abandon: revoke
      // it and re-rotate from the presented row instead of minting a second live descendant.
      if (successor) await this.sessions.revoke(successor.id, tx);
      return { kind: 'issued', tokens: await this.rotateFresh(session, device, tx) };
    }

    this.logger.warn({ userId: session.userId, sessionId: session.id }, 'Refresh token theft detected; revoking all sessions');
    await this.revokeAllForUser(session.userId, tx);
    await this.audit.record(
      {
        actorUserId: session.userId,
        action: 'auth.refresh_theft_detected',
        entityType: 'auth_session',
        entityId: session.id,
        ipHash: device.ipHash,
      },
      tx,
    );
    return { kind: 'theft' };
  }

  async revoke(sessionId: string, tx?: Database): Promise<void> {
    if (tx) return this.sessions.revoke(sessionId, tx);
    return this.transactions.run((t) => this.sessions.revoke(sessionId, t));
  }

  /** Logout-everywhere, password reset, account deletion (docs/11 §2.1, §2.3, §4.1): revokes every
   * live session and bumps `token_version`, so outstanding access tokens die immediately too, not
   * just future refreshes. */
  async revokeAllForUser(userId: string, tx?: Database): Promise<void> {
    const run = async (t: Database) => {
      await this.sessions.revokeAllForUser(userId, t);
      await this.users.bumpTokenVersion(userId, t);
    };
    return tx ? run(tx) : this.transactions.run(run);
  }
}
