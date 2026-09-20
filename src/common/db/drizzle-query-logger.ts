import type { Logger as DrizzleLogger } from 'drizzle-orm/logger';
import type { PinoLogger } from '../logging/index.js';

/**
 * Development aid (DB_LOG_QUERIES=true): prints each SQL statement at debug so
 * an N+1 or a missing index shows up while the query is being written.
 * Statement text only: parameter values can hold emails, hashes and tokens, so
 * they are never logged, just counted.
 */
export class DrizzleQueryLogger implements DrizzleLogger {
  constructor(private readonly logger: PinoLogger) {}

  logQuery(query: string, params: unknown[]): void {
    this.logger.debug({ sql: query, paramCount: params.length }, 'query');
  }
}
