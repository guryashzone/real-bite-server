/**
 * Base for every business-rule error (docs/02 §4.4). Services throw a subclass; controllers
 * never catch or reshape it. The global exception filter is the only place that turns one into
 * wire JSON, using `code` and `status` — never the class name or a driver message.
 */
export abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly status: number;
  /** Field-level detail (e.g. validation issues). Never a stack trace or driver text. */
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}
