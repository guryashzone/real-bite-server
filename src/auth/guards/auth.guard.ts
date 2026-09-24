import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthSessionsRepository } from '../auth-sessions.repository.js';
import type { AuthenticatedUser } from '../current-user.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { Role } from '../decorators/roles.decorator.js';
import { TokenService } from '../token.service.js';

/**
 * Default-deny (docs/02 §4.5): every route needs a valid session unless marked `@Public()`. The
 * JWT signature and expiry alone are never enough — one indexed query re-checks session
 * revocation, `token_version` and account status/role on every request (docs/11 §2.1). No caching.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(AuthSessionsRepository) private readonly sessions: AuthSessionsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    let claims;
    try {
      claims = this.tokens.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const guardContext = await this.sessions.findGuardContext(claims.sid, claims.sub);
    if (
      !guardContext ||
      guardContext.sessionRevokedAt !== null ||
      guardContext.sessionExpiresAt < new Date() ||
      guardContext.userTokenVersion !== claims.ver ||
      guardContext.userStatus !== 'active'
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    request.user = { id: guardContext.userId, role: guardContext.userRole as Role, sessionId: guardContext.sessionId };
    return true;
  }
}

function bearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}
