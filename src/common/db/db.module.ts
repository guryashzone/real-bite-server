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
import { TransactionRunner } from './transaction-runner.js';

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
        new pg.Pool({
          connectionString: config.get('DATABASE_URL'),
          // Without these, a hung database pins connections and queued
          // requests forever (pg's defaults are "no limit"). A caller waiting
          // for a connection fails after 5 s; a statement is cancelled by the
          // server after 15 s. Long jobs raise it per transaction with
          // `SET LOCAL statement_timeout`.
          connectionTimeoutMillis: 5_000,
          statement_timeout: 15_000,
        }),
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
    TransactionRunner,
  ],
  // PG_POOL stays internal: features query through the Drizzle `DB` only.
  exports: [DB, TransactionRunner],
})
export class DbModule {}
