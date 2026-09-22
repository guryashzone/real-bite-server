/**
 * What the geo endpoints return. Every row carries its resolved `path` (broadest first, itself
 * last: `["India", "Karnataka", "Bengaluru"]`) so the app can label a place without another call
 * (docs/11 §4). Coordinates are never returned; only ids and names.
 */

export interface CountryArea {
  id: string;
  level: 'country';
  name: string;
  slug: string;
  iso2: string;
  isLaunched: boolean;
  path: string[];
}

export interface StateArea {
  id: string;
  level: 'state';
  name: string;
  slug: string;
  /** ISO 3166-2 suffix (`KA`). */
  code: string | null;
  /** What the country calls this level: `state` | `union_territory` | `province` | `region`. */
  kind: string;
  isLaunched: boolean;
  countryId: string;
  path: string[];
}

export interface CityArea {
  id: string;
  level: 'city';
  name: string;
  slug: string;
  isLaunched: boolean;
  countryId: string;
  /** Null for city-states and countries with no subdivision level. */
  stateId: string | null;
  path: string[];
}

export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * A list endpoint's `data`. Cursor, not offset — keyset pagination over launched-first/name/id
 * order, so a page never skips or repeats a row as the picker's underlying tables grow
 * (docs/12). Nested under `pagination` to fit the standard response envelope alongside `items`.
 */
export interface Page<T> {
  items: T[];
  pagination: { nextCursor: string | null };
}

export interface GeoSearchResult {
  countries: CountryArea[];
  states: StateArea[];
  cities: CityArea[];
}

/** Named `region` in the API (docs/11 §4); it is a `states` row. */
export interface ResolvedGeo {
  country: CountryArea | null;
  region: StateArea | null;
  city: CityArea | null;
  /** 0–100, from the signal that produced it (docs/12 §2.3). 0 = nothing resolved = global. */
  confidence: number;
}
