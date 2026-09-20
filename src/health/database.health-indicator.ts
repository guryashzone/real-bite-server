import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { PinoLogger } from '../common/logging/index.js';

const PING_TIMEOUT_MS = 2000;

@Injectable()
export class DatabaseHealthIndicator {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(HealthIndicatorService)
    private readonly indicator: HealthIndicatorService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DatabaseHealthIndicator.name);
  }

  async isHealthy(key: string) {
    const session = this.indicator.check(key);
    let timer: NodeJS.Timeout | undefined;
    try {
      // A hung database must fail the probe, not hang it.
      await Promise.race([
        this.db.execute(sql`select 1`),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('database ping timed out')),
            PING_TIMEOUT_MS,
          );
        }),
      ]);
      return session.up();
    } catch (err) {
      // Public endpoint: log the cause, return a fixed message.
      this.logger.warn({ err }, 'Database ping failed');
      return session.down({ message: 'database unreachable' });
    } finally {
      clearTimeout(timer);
    }
  }
}
