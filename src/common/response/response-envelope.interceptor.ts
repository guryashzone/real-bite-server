import { Inject, Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, type Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator.js';
import { SKIP_ENVELOPE_KEY } from './skip-envelope.decorator.js';

const DEFAULT_MESSAGE = 'OK';

/**
 * The only place the success envelope is built (mirrors `GlobalExceptionFilter` on the error
 * side): every 2xx response becomes `{ success: true, message, data }`. Controllers keep
 * returning plain response DTOs from their mappers; this wraps them, so a handler never
 * hand-builds the envelope itself and can't drift from it.
 *
 * `@SkipEnvelope()` opts a route out (health, so Terminus' own body reaches the uptime check
 * untouched). `@ResponseMessage('...')` sets the message; unset handlers get "OK".
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_MESSAGE;

    return next.handle().pipe(map((data) => ({ success: true, message, data: data ?? {} })));
  }
}
