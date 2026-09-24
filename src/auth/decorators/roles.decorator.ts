import { SetMetadata } from '@nestjs/common';

export type Role = 'user' | 'moderator' | 'admin';

export const ROLES_KEY = 'roles';

/** Checked against the role `AuthGuard` just read from the database, never a token claim
 * (docs/11 §2.1). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
