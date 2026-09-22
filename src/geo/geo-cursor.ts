import { z } from 'zod';

/**
 * Keyset position in the picker order: launched areas first, then name, then id as the tiebreak
 * (docs/11 §4). Opaque to clients: base64url JSON, validated on the way back in.
 */
const cursorPayload = z.strictObject({
  l: z.boolean(),
  n: z.string().max(200),
  i: z.uuid(),
});

export type GeoCursor = z.infer<typeof cursorPayload>;

export function encodeCursor(row: { isLaunched: boolean; name: string; id: string }): string {
  const payload: GeoCursor = { l: row.isLaunched, n: row.name, i: row.id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Zod field for `?cursor=`: decodes to the payload, or fails validation as a 400. */
export const cursorField = z
  .string()
  .max(512)
  .transform((raw, ctx): GeoCursor => {
    try {
      const parsed = cursorPayload.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through: not base64url JSON
    }
    ctx.issues.push({ code: 'custom', message: 'Invalid cursor', input: raw });
    return z.NEVER;
  });
