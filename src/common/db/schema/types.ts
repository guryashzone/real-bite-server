import { customType } from 'drizzle-orm/pg-core';

/** Case-insensitive text (extension `citext`). Slugs, emails and codes use it. */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/**
 * PostGIS point, WGS84. Read as GeoJSON via `ST_AsGeoJSON`; written through `ST_SetSRID(
 * ST_MakePoint(lng, lat), 4326)` — repositories do that explicitly rather than passing raw values.
 *
 * drizzle-kit quotes custom column types in generated SQL (`"geography(Point,4326)"`), which
 * Postgres rejects; unquote it by hand in the migration (docs: server CLAUDE.md).
 */
export const geographyPoint = customType<{ data: { lat: number; lng: number }; driverData: string }>({
  dataType: () => 'geography(Point,4326)',
});
