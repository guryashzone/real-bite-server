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
