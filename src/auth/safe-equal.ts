import { timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison — used for the hashed 6-digit codes so a wrong guess doesn't
 * leak how many characters matched via response timing. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
