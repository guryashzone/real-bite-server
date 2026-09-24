import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { cities, countries, states } from '../common/db/schema/index.js';
import type { GeoCursor } from './geo-cursor.js';
import type { Coordinate } from './geo.types.js';

export interface CountryRow {
  id: string;
  name: string;
  slug: string;
  iso2: string;
  isLaunched: boolean;
}

export interface StateRow {
  id: string;
  name: string;
  slug: string;
  code: string | null;
  kind: string;
  isLaunched: boolean;
  countryId: string;
  countryName: string;
}

export interface CityRow {
  id: string;
  name: string;
  slug: string;
  isLaunched: boolean;
  countryId: string;
  countryName: string;
  stateId: string | null;
  stateName: string | null;
}

/** A city plus the country and state columns needed to build all three levels of a resolve. */
export interface ResolvedRow extends CityRow {
  countryIso2: string;
  countryIsLaunched: boolean;
  countrySlug: string;
  stateSlug: string | null;
  stateCode: string | null;
  stateKind: string | null;
  stateIsLaunched: boolean | null;
}

export interface ListFilter {
  q?: string;
  cursor?: GeoCursor;
  /** Rows to return; the query asks for one extra to learn whether another page exists. */
  limit: number;
}

type Leveled = typeof countries | typeof states | typeof cities;

const countryColumns = {
  id: countries.id,
  name: countries.name,
  slug: countries.slug,
  iso2: countries.iso2,
  isLaunched: countries.isLaunched,
};

const stateColumns = {
  id: states.id,
  name: states.name,
  slug: states.slug,
  code: states.code,
  kind: states.kind,
  isLaunched: states.isLaunched,
  countryId: states.countryId,
  countryName: countries.name,
};

const cityColumns = {
  id: cities.id,
  name: cities.name,
  slug: cities.slug,
  isLaunched: cities.isLaunched,
  countryId: cities.countryId,
  countryName: countries.name,
  stateId: cities.stateId,
  stateName: states.name,
};

/** `%`, `_` and `\` are LIKE wildcards; the user's text is a literal. */
function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`;
}

function prefixPattern(q: string): string {
  return `${q.replace(/[\\%_]/g, '\\$&')}%`;
}

/** Picker order: launched first, then name; id makes it total so paging never skips or repeats. */
function pickerOrder(t: Leveled) {
  return [desc(t.isLaunched), asc(t.name), asc(t.id)];
}

/** Autocomplete order: launched first, then names that start with `q`, then the rest. */
function searchOrder(t: Leveled, q: string) {
  return [desc(t.isLaunched), desc(ilike(t.name, prefixPattern(q))), asc(t.name)];
}

/** Rows strictly after the cursor in picker order (`is_launched desc` is `not is_launched asc`). */
function afterCursor(t: Leveled, cursor: GeoCursor | undefined): SQL | undefined {
  if (!cursor) return undefined;
  return sql`(not ${t.isLaunched}, ${t.name}, ${t.id}) > (${!cursor.l}::boolean, ${cursor.n}::text, ${cursor.i}::uuid)`;
}

@Injectable()
export class GeoRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  listCountries({ q, cursor, limit }: ListFilter): Promise<CountryRow[]> {
    return this.db
      .select(countryColumns)
      .from(countries)
      .where(and(q ? ilike(countries.name, containsPattern(q)) : undefined, afterCursor(countries, cursor)))
      .orderBy(...pickerOrder(countries))
      .limit(limit + 1);
  }

  listStates(filter: ListFilter & { countryId?: string }): Promise<StateRow[]> {
    const { q, cursor, limit, countryId } = filter;
    return this.db
      .select(stateColumns)
      .from(states)
      .innerJoin(countries, eq(countries.id, states.countryId))
      .where(
        and(
          countryId ? eq(states.countryId, countryId) : undefined,
          q ? ilike(states.name, containsPattern(q)) : undefined,
          afterCursor(states, cursor),
        ),
      )
      .orderBy(...pickerOrder(states))
      .limit(limit + 1);
  }

  listCities(filter: ListFilter & { countryId?: string; stateId?: string }): Promise<CityRow[]> {
    const { q, cursor, limit, countryId, stateId } = filter;
    return this.db
      .select(cityColumns)
      .from(cities)
      .innerJoin(countries, eq(countries.id, cities.countryId))
      .leftJoin(states, eq(states.id, cities.stateId))
      .where(
        and(
          countryId ? eq(cities.countryId, countryId) : undefined,
          stateId ? eq(cities.stateId, stateId) : undefined,
          q ? ilike(cities.name, containsPattern(q)) : undefined,
          afterCursor(cities, cursor),
        ),
      )
      .orderBy(...pickerOrder(cities))
      .limit(limit + 1);
  }

  searchCountries(q: string, limit: number): Promise<CountryRow[]> {
    return this.db
      .select(countryColumns)
      .from(countries)
      .where(ilike(countries.name, containsPattern(q)))
      .orderBy(...searchOrder(countries, q))
      .limit(limit);
  }

  searchStates(q: string, limit: number): Promise<StateRow[]> {
    return this.db
      .select(stateColumns)
      .from(states)
      .innerJoin(countries, eq(countries.id, states.countryId))
      .where(ilike(states.name, containsPattern(q)))
      .orderBy(...searchOrder(states, q))
      .limit(limit);
  }

  searchCities(q: string, limit: number): Promise<CityRow[]> {
    return this.db
      .select(cityColumns)
      .from(cities)
      .innerJoin(countries, eq(countries.id, cities.countryId))
      .leftJoin(states, eq(states.id, cities.stateId))
      .where(ilike(cities.name, containsPattern(q)))
      .orderBy(...searchOrder(cities, q))
      .limit(limit);
  }

  /** The seeded city nearest to a point within `radiusM`, or none. Uses the GiST index on `center`. */
  async nearestCity({ lat, lng }: Coordinate, radiusM: number): Promise<ResolvedRow | undefined> {
    const point = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
    const [row] = await this.resolvedCityQuery()
      .where(sql`ST_DWithin(${cities.center}, ${point}, ${radiusM})`)
      .orderBy(sql`${cities.center} <-> ${point}`)
      .limit(1);
    return row;
  }

  /** The best trigram match for freeform city text off a screenshot (docs/12 §2.3), or none. */
  async bestCityMatch(q: string): Promise<ResolvedRow | undefined> {
    const [row] = await this.resolvedCityQuery()
      .where(ilike(cities.name, containsPattern(q)))
      .orderBy(...searchOrder(cities, q))
      .limit(1);
    return row;
  }

  /** ISO2 exact match first (a screenshot's country hint is usually a code), else the best name
   * match. */
  async findCountryByHint(hint: string): Promise<CountryRow | undefined> {
    const [byCode] = await this.db
      .select(countryColumns)
      .from(countries)
      .where(eq(countries.iso2, hint.toUpperCase()))
      .limit(1);
    if (byCode) return byCode;

    const [byName] = await this.db
      .select(countryColumns)
      .from(countries)
      .where(ilike(countries.name, containsPattern(hint)))
      .orderBy(...searchOrder(countries, hint))
      .limit(1);
    return byName;
  }

  private resolvedCityQuery() {
    return this.db
      .select({
        ...cityColumns,
        countryIso2: countries.iso2,
        countryIsLaunched: countries.isLaunched,
        countrySlug: countries.slug,
        stateSlug: states.slug,
        stateCode: states.code,
        stateKind: states.kind,
        stateIsLaunched: states.isLaunched,
      })
      .from(cities)
      .innerJoin(countries, eq(countries.id, cities.countryId))
      .leftJoin(states, eq(states.id, cities.stateId));
  }
}
