import { DomainException } from './domain-exception.js';

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Thrown by `ZodValidationPipe` on a failed parse. `details` is one entry per Zod issue. */
export class ValidationFailedException extends DomainException {
  readonly code = 'validation_failed';
  readonly status = 400;

  constructor(details: ValidationIssue[]) {
    super('Request validation failed', details);
  }
}
