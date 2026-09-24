import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from './decorators/roles.decorator.js';

/** What `AuthGuard` attaches to the request after its one indexed check (docs/11 §2.1). Role and
 * status are read fresh from the database on every request, never from the token. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
  sessionId: string;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
  if (!request.user) throw new Error('CurrentUser used on a route with no AuthGuard');
  return request.user;
});
