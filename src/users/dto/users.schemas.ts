import { z } from 'zod';

const themePref = z.enum(['system', 'light', 'dark']);
const displayName = z.string().trim().min(1).max(80);

/** `PATCH /v1/me`'s home location (docs/11 §4): the most specific id given wins, and the whole
 * field is optional at the request level — omitting it entirely leaves the current home alone.
 * `null` clears it. When present as an object, it must name at least one level (the DB's
 * `user_locations_has_signal` check would otherwise reject an empty row). */
const homeLocation = z
  .strictObject({
    countryId: z.uuid().optional(),
    stateId: z.uuid().optional(),
    cityId: z.uuid().optional(),
  })
  .refine((v) => v.countryId ?? v.stateId ?? v.cityId, 'homeLocation must name at least one place')
  .nullable();

export const patchMeBody = z.strictObject({
  displayName: displayName.optional(),
  themePref: themePref.optional(),
  homeLocation: homeLocation.optional(),
});
export type PatchMeBody = z.infer<typeof patchMeBody>;

export const setConsentBody = z.strictObject({
  kind: z.enum(['terms', 'privacy', 'photo_display', 'photo_commercial', 'photo_training', 'location']),
  version: z.string().trim().min(1).max(40),
  granted: z.boolean(),
});
export type SetConsentBody = z.infer<typeof setConsentBody>;
