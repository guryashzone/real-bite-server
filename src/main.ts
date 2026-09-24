import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import type { Env } from './common/config/env.schema.js';
import { NestPinoLogger } from './common/logging/index.js';

async function bootstrap() {
  // Nest's default body parser is replaced below so the 1 MB cap applies
  // (uploads bypass the API entirely: docs/11 §8).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    bufferLogs: true, // hold boot logs until the Pino logger is ready
  });
  app.useLogger(app.get(NestPinoLogger));
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // /v1/... today; a breaking change adds @Version('2') beside the old handler.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  // One hop behind nginx (docs/11 §7.1): trust its X-Forwarded-For so req.ip is the real client,
  // not the proxy — login lockout and rate limits key on it.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  app.enableCors({ origin: config.get('CORS_ORIGINS') });
  app.enableShutdownHooks();

  // 0.0.0.0 on purpose: inside Docker, nginx reaches us as api:3000 and the
  // port is never published to the host (docs/11 §7.1).
  await app.listen(config.get('PORT'), '0.0.0.0');
}
await bootstrap();
