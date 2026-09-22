import { z } from 'zod';
import { cursorField } from '../geo-cursor.js';

/** Search text, trimmed. Empty after trimming is the same as absent. */
const text = z
  .string()
  .trim()
  .max(80)
  .transform((value) => (value === '' ? undefined : value));

const limit = (fallback: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(fallback);

/** Every geographic parameter is optional: absent means global (docs/12 §3). */
const list = {
  q: text.optional(),
  cursor: cursorField.optional(),
  limit: limit(50, 100),
};

export const listCountriesQuery = z.strictObject(list);
export type ListCountriesQuery = z.infer<typeof listCountriesQuery>;

export const listStatesQuery = z.strictObject({ ...list, countryId: z.uuid().optional() });
export type ListStatesQuery = z.infer<typeof listStatesQuery>;

export const listCitiesQuery = z.strictObject({
  ...list,
  countryId: z.uuid().optional(),
  stateId: z.uuid().optional(),
});
export type ListCitiesQuery = z.infer<typeof listCitiesQuery>;

export const searchQuery = z.strictObject({
  q: z.string().trim().min(2).max(80),
  /** Per level: the picker shows a few of each, not a page. */
  limit: limit(5, 20),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const resolveQuery = z.strictObject({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
export type ResolveQuery = z.infer<typeof resolveQuery>;
