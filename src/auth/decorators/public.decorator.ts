import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global default-deny `AuthGuard` (docs/02 §4.5). Everything else needs
 * a valid session; a forgotten decorator therefore fails closed, not open. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
