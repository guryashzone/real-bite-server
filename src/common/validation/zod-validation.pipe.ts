import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType, output } from 'zod';

/**
 * Validates one request part (`@Query`, `@Param`, `@Body`) against a strict Zod schema, one pipe
 * instance per parameter. A failure is a 400 in the standard error envelope
 * (`{ error: { code, message, details } }`, docs/11 §4) and never echoes the input back.
 */
export class ZodValidationPipe<S extends ZodType> implements PipeTransform<unknown, output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new BadRequestException({
      error: {
        code: 'validation_failed',
        message: 'Request validation failed',
        details: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }
}
