import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { Env } from '../config/env.schema.js';
import { buildPinoHttpOptions } from './pino-options.js';

/**
 * Pino, and only Pino (docs/11 §7.4). `nestjs-pino` is global once imported:
 * it replaces Nest's logger, logs every HTTP request, and binds the request
 * to every log line written while handling it.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: buildPinoHttpOptions({
          nodeEnv: config.get('NODE_ENV'),
          level: config.get('LOG_LEVEL'),
        }),
      }),
    }),
  ],
})
export class LoggingModule {}
