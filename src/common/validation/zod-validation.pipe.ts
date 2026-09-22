import type { PipeTransform } from '@nestjs/common';
import type { ZodType, output } from 'zod';
import { ValidationFailedException } from '../errors/index.js';

/**
 * Validates one request part (`@Query`, `@Param`, `@Body`) against a strict Zod schema, one pipe
 * instance per parameter. A failure throws `ValidationFailedException`, which
 * `GlobalExceptionFilter` turns into the standard error envelope — the pipe itself never builds
 * response JSON, and never echoes the input back.
 */
export class ZodValidationPipe<S extends ZodType> implements PipeTransform<unknown, output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ValidationFailedException(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
}
