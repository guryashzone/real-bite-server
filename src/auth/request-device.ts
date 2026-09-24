import type { Request } from 'express';
import { hashIp } from '../common/security/ip-hash.js';
import type { DeviceInfo } from './session.service.js';

/** Client-supplied device context for `auth_sessions` (docs/11 §3.1) — best-effort, never trusted
 * for anything security-relevant. `X-Platform`/`X-App-Version`/`X-Device-Label` are this app's own
 * headers; `User-Agent` and the client IP are standard. */
export function deviceFromRequest(request: Request): DeviceInfo & { ipHash: string } {
  return {
    platform: header(request, 'x-platform'),
    appVersion: header(request, 'x-app-version'),
    deviceLabel: header(request, 'x-device-label'),
    userAgent: request.headers['user-agent'] ?? null,
    ipHash: hashIp(request.ip ?? 'unknown'),
  };
}

function header(request: Request, name: string): string | null {
  const value = request.headers[name];
  return typeof value === 'string' ? value : null;
}
