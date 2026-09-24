import { Inject, Injectable } from '@nestjs/common';
import { DB } from './db.constants.js';
import type { Database } from './db.types.js';

/**
 * One transaction is one owning service method (docs/02 §4.3): the orchestrating service calls
 * `run`, gets `tx`, and passes it down to every repository and lower-layer service call it makes.
 * There is no ambient or per-request transaction.
 */
@Injectable()
export class TransactionRunner {
  constructor(@Inject(DB) private readonly db: Database) {}

  run<T>(fn: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }
}
