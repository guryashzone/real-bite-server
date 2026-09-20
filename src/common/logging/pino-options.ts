import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggingSettings {
  nodeEnv: 'development' | 'test' | 'production';
  /** LOG_LEVEL. Defaults to info in production, debug in development, silent in tests. */
  level?: LogLevel;
}

// Keys that must never reach a log line (docs/11 §7.4, §8). Pino redaction is
// path-based, so each key is covered at the top level and one and two levels
// down. The bigger protection is not logging bodies, OCR text, capture
// locations, photo bytes or full email addresses in the first place.
const SECRET_KEYS = [
  'password',
  'newPassword',
  'currentPassword',
  'refreshToken',
  'accessToken',
  'idToken',
  'lines', // redacted scan text
];

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Verification/reset codes. Exactly as docs/11 §7.4 specifies (`*.code`):
  // note it also masks `err.code` on driver errors.
  '*.code',
  ...SECRET_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
];

const SAFE_REQUEST_ID = /^[\w.-]{1,64}$/;

type Req = IncomingMessage & {
  id?: string | number | object;
  originalUrl?: string;
};

function pathOf(req: Req): string {
  // Path only. Query strings carry lat/lng and search text (location is
  // personal data under DPDP), so they never reach a log line.
  return (req.originalUrl ?? req.url ?? '').split('?')[0]!;
}

/** Honours a well-formed X-Request-Id, otherwise generates one; always echoes it back. */
export function genReqId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers['x-request-id'];
  const candidate = Array.isArray(header) ? header[0] : header;
  const id =
    candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

/** info for requests, warn for handled refusals (4xx), error for failures (5xx). */
export function customLogLevel(
  _req: IncomingMessage,
  res: ServerResponse,
  err?: Error,
): 'info' | 'warn' | 'error' {
  if (err || res.statusCode >= 500) return 'error';
  if (res.statusCode >= 400) return 'warn';
  return 'info';
}

export function buildPinoHttpOptions({
  nodeEnv,
  level,
}: LoggingSettings): Options {
  const isProd = nodeEnv === 'production';
  return {
    level: level ?? (isProd ? 'info' : nodeEnv === 'test' ? 'silent' : 'debug'),
    redact: REDACT_PATHS,
    genReqId,
    // Every line logged while handling a request (ours and the request line)
    // carries requestId. userId joins it once auth exists.
    customProps: (req) => ({ requestId: (req as Req).id }),
    customLogLevel,
    customSuccessMessage: (req, res, ms) =>
      `${req.method} ${pathOf(req as Req)} ${res.statusCode} ${Math.round(ms)}ms`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${pathOf(req as Req)} ${res.statusCode} ${err.message}`,
    serializers: {
      req: (req: Req) => ({ id: req.id, method: req.method, url: pathOf(req) }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
    // The Docker healthcheck polls this every few seconds.
    autoLogging: {
      ignore: (req) => pathOf(req as Req).startsWith('/v1/health/live'),
    },
    // Development only: `[reqId] [Context] message`, one line per event.
    // Production writes raw JSON to stdout (Docker → CloudWatch).
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,req,res,responseTime,requestId,context',
            messageFormat:
              '{if requestId}[{requestId}] {end}{if context}[{context}] {end}{msg}',
          },
        },
  };
}
