import { z } from 'zod';

export const envSchema = z.object({
  // Required on purpose: a production box that forgets it must fail to start,
  // not quietly boot with development logging.
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // HS256 access-token signing key (docs/11 §2.1). SSM Parameter Store in prod; no default, so a
  // box that forgets it fails to start rather than signing tokens with an empty secret.
  JWT_SECRET: z.string().min(32),
  // Both accepted for one sign-in flow: Android Google Sign-In issues against the web client id
  // (docs/11 §2.2).
  GOOGLE_ANDROID_CLIENT_ID: z.string().min(1),
  GOOGLE_WEB_CLIENT_ID: z.string().min(1),
  // Defaults: 'info' in production, 'silent' under test, 'debug' otherwise.
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  // Development aid: log each SQL statement (text only, never parameters) at debug.
  DB_LOG_QUERIES: z.stringbool().default(false),
  // Comma-separated list of allowed browser origins (admin SPA etc.). The
  // mobile app is not subject to CORS, so empty means "no browser origins".
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;
export type NodeEnv = Env['NODE_ENV'];
export type LogLevel = NonNullable<Env['LOG_LEVEL']>;

/** Used by ConfigModule: fails the boot with a readable message on bad env. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
