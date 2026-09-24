import { Inject, Injectable } from '@nestjs/common';
import { encodeCursor } from './geo-cursor.js';
import { toCityArea, toCountryArea, toResolvedAncestors, toStateArea } from './geo.mapper.js';
import { GeoRepository } from './geo.repository.js';
import type { CityArea, CountryArea, GeoSearchResult, Page, ResolvedGeo, StateArea } from './geo.types.js';
import type {
  ListCitiesQuery,
  ListCountriesQuery,
  ListStatesQuery,
  ResolveQuery,
  ResolveSignalsBody,
  SearchQuery,
} from './dto/geo.schemas.js';

/**
 * Confidence of a coordinate fix (docs/12 §2.3: device coordinates score 80). It is the signal's
 * confidence, not a distance measure, so a match inside the radius is 80 wherever in it.
 */
const DEVICE_FIX_CONFIDENCE = 80;

/** docs/12 §2.3's confidence table for the two screenshot-derived signals this endpoint can
 * actually resolve today (outlet-level signals need the `outlets` table, phase 4 — not built). */
const CITY_TEXT_CONFIDENCE = 70;
const COUNTRY_HINT_CONFIDENCE = 20;

/**
 * How far from a seeded city centre a fix still counts as "in" that city. The catalogue has no
 * boundary polygons, so this is an approximation, and outside it we say "unknown" rather than
 * guess a country: a fix in Kathmandu must not come back as India.
 */
const RESOLVE_RADIUS_M = 50_000;

/** Rows came back with one extra (`limit + 1`); its presence means another page exists. */
function toPage<R extends { id: string; name: string; isLaunched: boolean; }, T>(
  rows: R[],
  limit: number,
  map: (row: R) => T,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items: items.map(map),
    pagination: { nextCursor: rows.length > limit && last ? encodeCursor(last) : null },
  };
}

@Injectable()
export class GeoService {
  constructor(@Inject(GeoRepository) private readonly repository: GeoRepository) { }

  async listCountries(query: ListCountriesQuery): Promise<Page<CountryArea>> {
    const rows = await this.repository.listCountries(query);
    return toPage(rows, query.limit, toCountryArea);
  }

  async listStates(query: ListStatesQuery): Promise<Page<StateArea>> {
    const rows = await this.repository.listStates(query);
    return toPage(rows, query.limit, toStateArea);
  }

  async listCities(query: ListCitiesQuery): Promise<Page<CityArea>> {
    const rows = await this.repository.listCities(query);
    return toPage(rows, query.limit, toCityArea);
  }

  /** One round trip for the picker, grouped by level. */
  async search({ q, limit }: SearchQuery): Promise<GeoSearchResult> {
    const [countries, states, cities] = await Promise.all([
      this.repository.searchCountries(q, limit),
      this.repository.searchStates(q, limit),
      this.repository.searchCities(q, limit),
    ]);
    return {
      countries: countries.map(toCountryArea),
      states: states.map(toStateArea),
      cities: cities.map(toCityArea),
    };
  }

  /** Coordinates in, coarse ids out. The coordinates themselves are never stored or echoed. */
  async resolve(coordinate: ResolveQuery): Promise<ResolvedGeo> {
    const row = await this.repository.nearestCity(coordinate, RESOLVE_RADIUS_M);
    if (!row) return { country: null, region: null, city: null, confidence: 0 };
    return { ...toResolvedAncestors(row), city: toCityArea(row), confidence: DEVICE_FIX_CONFIDENCE };
  }

  /**
   * Screenshot signals in, resolved context + confidence out (docs/11 §4, docs/12 §2.3) — never
   * stored: "Query context ... overrides [home and last-seen], for that query only." The caller
   * (the app, or a future `POST /v1/scans`) uses the result for that one request.
   *
   * The highest-confidence signal given wins: coordinates (a device fix bundled with the
   * screenshot) beat city text, which beats a bare country hint. Outlet-level signals (a listing
   * URL, an address match — 95 and 85 in the docs/12 table) need the `outlets` table, which
   * doesn't exist in this repo yet (phase 4); this endpoint resolves what it can today.
   */
  async resolveSignals(input: ResolveSignalsBody): Promise<ResolvedGeo> {
    if (input.lat !== undefined && input.lng !== undefined) {
      return this.resolve({ lat: input.lat, lng: input.lng });
    }

    if (input.cityText) {
      const row = await this.repository.bestCityMatch(input.cityText);
      if (row) return { ...toResolvedAncestors(row), city: toCityArea(row), confidence: CITY_TEXT_CONFIDENCE };
    }

    if (input.countryHint) {
      const row = await this.repository.findCountryByHint(input.countryHint);
      if (row) return { country: toCountryArea(row), region: null, city: null, confidence: COUNTRY_HINT_CONFIDENCE };
    }

    return { country: null, region: null, city: null, confidence: 0 };
  }
}

