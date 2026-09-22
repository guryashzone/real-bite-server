import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { citext, geographyPoint } from './types.js';

/**
 * Geography is three linked tables — country → state → city — not one polymorphic table
 * (docs/12 §2.1). The hierarchy is a fixed depth, so a plain parent FK at each level beats an
 * ltree path: the tier checks in ranking become `city_id = $1` / `state_id = $2` / `country_id = $3`
 * equality, and each level keeps the columns that only make sense at that level.
 *
 * `is_launched` means "we seed and curate here". It is **never** a search filter (docs/12 §2.1):
 * an un-launched area is selectable and simply falls back to its country's results.
 */

export const countries = pgTable(
  'countries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    iso2: char('iso2', { length: 2 }).notNull(),
    iso3: char('iso3', { length: 3 }).notNull(),
    name: text('name').notNull(),
    slug: citext('slug').notNull(),
    phoneCode: text('phone_code'),
    currency: char('currency', { length: 3 }),
    center: geographyPoint('center'),
    isLaunched: boolean('is_launched').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('countries_iso2_key').on(table.iso2),
    unique('countries_iso3_key').on(table.iso3),
    unique('countries_slug_key').on(table.slug),
    index('countries_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
  ],
);

export const states = pgTable(
  'states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id),
    /** ISO 3166-2 subdivision suffix, e.g. `KA` for Karnataka. */
    code: text('code'),
    name: text('name').notNull(),
    slug: citext('slug').notNull(),
    /** `state` | `union_territory` | `province` | `region` — what the country calls this level. */
    kind: text('kind').notNull().default('state'),
    center: geographyPoint('center'),
    isLaunched: boolean('is_launched').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('states_country_slug_key').on(table.countryId, table.slug),
    // Target for the composite FK on cities: a city's state must belong to the city's country.
    unique('states_id_country_key').on(table.id, table.countryId),
    index('states_country').on(table.countryId),
    index('states_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
  ],
);

export const cities = pgTable(
  'cities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countryId: uuid('country_id')
      .notNull()
      .references(() => countries.id),
    /** Null for city-states (Singapore) and countries with no subdivision level. */
    stateId: uuid('state_id'),
    name: text('name').notNull(),
    slug: citext('slug').notNull(),
    center: geographyPoint('center').notNull(),
    timezone: text('timezone'),
    isLaunched: boolean('is_launched').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('cities_country_slug_key').on(table.countryId, table.slug),
    // Target for the composite FK on user_locations.
    unique('cities_id_country_key').on(table.id, table.countryId),
    // The database, not application code, rejects a Karnataka city filed under another country.
    foreignKey({
      name: 'cities_state_same_country',
      columns: [table.stateId, table.countryId],
      foreignColumns: [states.id, states.countryId],
    }),
    index('cities_country').on(table.countryId),
    index('cities_state').on(table.stateId),
    index('cities_name_trgm').using('gin', sql`${table.name} gin_trgm_ops`),
    // Nearest-city resolution (`GET /v1/geo/resolve`) is a `<->` / ST_DWithin on this column.
    index('cities_center_gist').using('gist', table.center),
  ],
);
