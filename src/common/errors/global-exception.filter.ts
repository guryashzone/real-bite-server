import { Catch, HttpException, HttpStatus, Inject } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from '../logging/index.js';
import { DomainException } from './domain-exception.js';

/** Stable `error_code` for a status Nest raised itself (a route it rejected before any handler
 * ran — an unknown path, a method mismatch — so there's no `DomainException` to read a code from). */
const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'bad_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthorized',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'method_not_allowed',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'unprocessable_entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'too_many_requests',
};

function codeForStatus(status: number): string {
  return CODE_BY_STATUS[status] ?? (status >= 500 ? 'internal_error' : 'error');
}

/** Default `Retry-After` seconds on 429 until a throttler profile provides its own value. */
const RETRY_AFTER_SECONDS = 60;

/**
 * The only place the error envelope is built (docs/02 §4.4): every thrown error becomes
 * `{ success: false, message, error_code, data: {}, details? }`, standardized per the response
 * format the team adopted, adapted for this repo — `error_code` holds our stable string
 * `DomainException.code` rather than a numeric catalog, since nothing here needs one.
 *
 * Health is the one exception: `HealthUnavailableFilter` catches its `ServiceUnavailableException`
 * first (controller-level filters run before this global one) and re-emits Terminus' own body,
 * because the external uptime check depends on that exact shape (docs/11 §4).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, message, code, details } = this.describe(exception);
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      response.setHeader('Retry-After', RETRY_AFTER_SECONDS);
    }
    response.status(status).json({
      success: false,
      message,
      error_code: code,
      data: {},
      ...(details !== undefined ? { details } : {}),
    });
  }

  private describe(exception: unknown): {
    status: number;
    message: string;
    code: string;
    details?: unknown;
  } {
    if (exception instanceof DomainException) {
      return {
        status: exception.status,
        message: exception.message,
        code: exception.code,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : ((body as { message?: string }).message ?? exception.message);
      return { status, message, code: codeForStatus(status) };
    }

    // Unknown failure: never send the real message or a stack trace to the client, but log it
    // with the request id so it's findable (PinoLogger binds that automatically per request).
    this.logger.error({ err: exception }, 'Unhandled exception');
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong. Please try again.',
      code: 'internal_error',
    };
  }
}
