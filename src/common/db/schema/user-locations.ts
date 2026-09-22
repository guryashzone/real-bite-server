import { check, index, integer, pgTable, smallint, text, timestamp, unique, uuid, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { cities, countries, states } from './geo.js';
import { users } from './users.js';
import { geographyPoint } from './types.js';

/**
 * Where a user is, as **context with a source and a confidence** — never a restriction on what
 * they can search (docs/12 §2.3). It is deliberately its own table rather than columns on `users`:
 * a user has more than one of these at once, each arriving from a different signal.
 *
 * - `home` — the durable default they chose (or we inferred). Survives travel.
 * - `last_seen` — where they actually were most recently. This is what a search uses first, so a
 *   Bengaluru user in New York gets New York results.
 *
 * A row references our own `cities`/`states`/`countries` **or** carries raw coordinates, or both:
 * a device fix resolves to a city, while a picked city has no coordinates at all.
 */
export const userLocations = pgTable(
  'user_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // A user's locations go with the user (docs/11 §4.1 deletion).
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    /** How we learned it; drives precedence when signals disagree (docs/12 §2.3). */
    source: text('source').notNull(),
    /** 0–100. A listing URL outranks a device fix outranks a picked city outranks a locale guess. */
    confidence: smallint('confidence').notNull(),
    countryId: uuid('country_id').references(() => countries.id),
    stateId: uuid('state_id'),
    cityId: uuid('city_id'),
    /** Private. Never returned by any endpoint; only coarse ids are used for ranking. */
    point: geographyPoint('point'),
    accuracyM: integer('accuracy_m'),
    /** When the signal was produced, which is not when we stored it. */
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('user_locations_user_kind_key').on(table.userId, table.kind),
    foreignKey({
      name: 'user_locations_city_same_country',
      columns: [table.cityId, table.countryId],
      foreignColumns: [cities.id, cities.countryId],
    }),
    foreignKey({
      name: 'user_locations_state_same_country',
      columns: [table.stateId, table.countryId],
      foreignColumns: [states.id, states.countryId],
    }),
    index('user_locations_user').on(table.userId),
    check('user_locations_kind_check', sql`${table.kind} in ('home', 'last_seen')`),
    check(
      'user_locations_source_check',
      sql`${table.source} in ('device_precise', 'device_approximate', 'picked_city', 'picked_state', 'picked_country', 'screenshot', 'inferred_locale', 'inferred_ip')`,
    ),
    check('user_locations_confidence_check', sql`${table.confidence} between 0 and 100`),
    // A row that names nowhere is not a location.
    check(
      'user_locations_has_signal',
      sql`${table.countryId} is not null or ${table.stateId} is not null or ${table.cityId} is not null or ${table.point} is not null`,
    ),
  ],
);
