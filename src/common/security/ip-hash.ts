import { createHash } from 'node:crypto';

/**
 * Raw IPs never reach a log line or a stored row (docs/11 §7.4); only this hash does. Not salted
 * per-user on purpose — the whole point is to group attempts *by* IP across users and requests.
 */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}
