/** Fixed by docs/11 §2.1 — not configurable; a policy change is a code change, reviewed like one. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 60;
export const REFRESH_REPLAY_GRACE_MS = 60_000;
export const REFRESH_REPLAY_MAX = 3;

/** docs/11 §2.3. */
export const VERIFICATION_CODE_TTL_MINUTES = 15;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
export const PASSWORD_MIN_LENGTH = 10;
/** A small blocklist of obviously weak passwords (docs/11 §2.3: no composition rules, just this). */
export const PASSWORD_BLOCKLIST = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  'qwertyuiop',
  '12345678910',
  'letmein123',
  'iloveyou123',
  'welcome123',
  'admin12345',
]);

/** docs/11 §2.3 lockout rule. */
export const LOGIN_EMAIL_LOCKOUT_THRESHOLD = 5;
export const LOGIN_EMAIL_LOCKOUT_WINDOW_MINUTES = 15;
export const LOGIN_IP_LOCKOUT_THRESHOLD = 20;
export const LOGIN_IP_LOCKOUT_WINDOW_MINUTES = 60;

/**
 * A precomputed Argon2id hash of a fixed dummy password, verified against on a login attempt for
 * an email that doesn't exist (or has no password) so that branch costs roughly the same CPU time
 * as a real wrong-password check — closing the "same shape and timing" enumeration requirement
 * (docs/11 §2.3) against a response-time side channel. Never a real user's hash.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$3nB1ZBTnfNiiScGBhwPBgQ$ONRiPdlxf+zfL10k9ar7GzEhKWctgCmAa28XpkiaD7Y';
