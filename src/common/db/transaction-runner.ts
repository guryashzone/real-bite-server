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

  /**
   * For a method that's sometimes the top of its own transaction and sometimes called as one step
   * inside a caller's larger one (an optional trailing `tx?: Database` parameter, the pattern
   * throughout `auth`/`users`): reuses `tx` when given, opens a fresh transaction otherwise. Keeps
   * that `tx ? fn(tx) : this.run(fn)` branch from being copied at every call site.
   */
  runOptional<T>(tx: Database | undefined, fn: (tx: Database) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.run(fn);
  }
}
