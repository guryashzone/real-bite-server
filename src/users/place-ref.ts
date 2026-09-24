/**
 * A place at up to three levels — the shape `user_locations`' geography columns, `/v1/me`'s home
 * location and its response all carry independently today. One name for it so it's declared once:
 * the repository reads/writes it, the mapper returns it as-is.
 */
export interface PlaceRef {
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
}
