import { defineConfig } from 'drizzle-kit';

// drizzle-kit doesn't read .env itself; Nest does it at runtime via ConfigModule.
try {
  process.loadEnvFile();
} catch {
  // no .env (e.g. CI): rely on the real environment
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/common/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
