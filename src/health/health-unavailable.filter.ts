import { Catch, ServiceUnavailableException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Controller-level filters run before the global one, so this intercepts Terminus' own 503 first
 * and re-emits its body untouched — `{ status, info, error, details }` — instead of letting
 * `GlobalExceptionFilter` reshape it into the standard envelope. The external uptime check reads
 * this exact shape (docs/11 §4), so it can't change with the rest of the API.
 */
@Catch(ServiceUnavailableException)
export class HealthUnavailableFilter implements ExceptionFilter {
  catch(exception: ServiceUnavailableException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
