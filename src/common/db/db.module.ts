import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Env } from '../config/env.schema.js';
import { PinoLogger } from '../logging/index.js';
import { DB, PG_POOL } from './db.constants.js';
import type { Database } from './db.types.js';
import { DrizzleQueryLogger } from './drizzle-query-logger.js';
import * as schema from './schema/index.js';

@Injectable()
class PoolLifecycle implements OnModuleInit, OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext('PgPool');
  }

  onModuleInit() {
    // An idle client whose backend dies (Postgres restart, failover) emits
    // 'error' on the pool; with no listener Node kills the whole process.
    // Log it and let the pool reconnect on the next query.
    this.pool.on('error', (err) => {
      this.logger.error({ err }, 'Idle database client error');
    });
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new pg.Pool({ connectionString: config.get('DATABASE_URL') }),
    },
    {
      provide: DB,
      inject: [PG_POOL, ConfigService, PinoLogger],
      useFactory: (
        pool: pg.Pool,
        config: ConfigService<Env, true>,
        logger: PinoLogger,
      ): Database => {
        logger.setContext('Drizzle');
        return drizzle(pool, {
          schema,
          logger: config.get('DB_LOG_QUERIES')
            ? new DrizzleQueryLogger(logger)
            : false,
        });
      },
    },
    PoolLifecycle,
  ],
  // PG_POOL stays internal: features query through the Drizzle `DB` only.
  exports: [DB],
})
export class DbModule {}
