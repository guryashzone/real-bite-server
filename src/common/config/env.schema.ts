import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  // Defaults to 'info' in production and 'debug' otherwise.
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
