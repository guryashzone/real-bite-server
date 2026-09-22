import type { CityRow, CountryRow, ResolvedRow, StateRow } from './geo.repository.js';
import type { CityArea, CountryArea, StateArea } from './geo.types.js';

/** Responses come from these mappers, never raw rows (server CLAUDE.md). */

export function toCountryArea(row: CountryRow): CountryArea {
  return {
    id: row.id,
    level: 'country',
    name: row.name,
    slug: row.slug,
    iso2: row.iso2,
    isLaunched: row.isLaunched,
    path: [row.name],
  };
}

export function toStateArea(row: StateRow): StateArea {
  return {
    id: row.id,
    level: 'state',
    name: row.name,
    slug: row.slug,
    code: row.code,
    kind: row.kind,
    isLaunched: row.isLaunched,
    countryId: row.countryId,
    path: [row.countryName, row.name],
  };
}

export function toCityArea(row: CityRow): CityArea {
  return {
    id: row.id,
    level: 'city',
    name: row.name,
    slug: row.slug,
    isLaunched: row.isLaunched,
    countryId: row.countryId,
    stateId: row.stateId,
    path: row.stateName ? [row.countryName, row.stateName, row.name] : [row.countryName, row.name],
  };
}

/** The country and state of a resolved city, rebuilt from the same joined row. */
export function toResolvedAncestors(row: ResolvedRow): { country: CountryArea; region: StateArea | null } {
  const country = toCountryArea({
    id: row.countryId,
    name: row.countryName,
    slug: row.countrySlug,
    iso2: row.countryIso2,
    isLaunched: row.countryIsLaunched,
  });
  const region =
    row.stateId && row.stateName && row.stateSlug && row.stateKind && row.stateIsLaunched !== null
      ? toStateArea({
          id: row.stateId,
          name: row.stateName,
          slug: row.stateSlug,
          code: row.stateCode,
          kind: row.stateKind,
          isLaunched: row.stateIsLaunched,
          countryId: row.countryId,
          countryName: row.countryName,
        })
      : null;
  return { country, region };
}
