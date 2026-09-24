import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB } from '../common/db/db.constants.js';
import type { Database } from '../common/db/db.types.js';
import { userLocations } from '../common/db/schema/index.js';

const HOME_KIND = 'home';
/** A picked place has no device fix to score, so it sits at the confidence level docs/12 §2.3
 * gives a "picked" signal — above a locale guess, below an actual device fix. */
const PICKED_CONFIDENCE = 60;

/** The most specific level the user picked names the source (docs/12 §2.3: picked_city outranks
 * picked_state outranks picked_country). */
function pickedSource(location: { countryId: string | null; stateId: string | null; cityId: string | null }): string {
  if (location.cityId) return 'picked_city';
  if (location.stateId) return 'picked_state';
  return 'picked_country';
}

export interface HomeLocationRow {
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
}

const homeColumns = {
  countryId: userLocations.countryId,
  stateId: userLocations.stateId,
  cityId: userLocations.cityId,
};

@Injectable()
export class UserLocationsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  findHome(userId: string, tx: Database = this.db): Promise<HomeLocationRow | undefined> {
    return tx
      .select(homeColumns)
      .from(userLocations)
      .where(and(eq(userLocations.userId, userId), eq(userLocations.kind, HOME_KIND)))
      .then((rows) => rows[0]);
  }

  /** One row per `(user, kind)` (docs/12 §2.3); `PATCH /v1/me` always sets it explicitly, so this
   * is a plain upsert on that unique key, not a read-then-write. */
  async setHome(
    userId: string,
    location: { countryId: string | null; stateId: string | null; cityId: string | null },
    tx: Database = this.db,
  ): Promise<void> {
    const source = pickedSource(location);
    await tx
      .insert(userLocations)
      .values({ userId, kind: HOME_KIND, source, confidence: PICKED_CONFIDENCE, ...location })
      .onConflictDoUpdate({
        target: [userLocations.userId, userLocations.kind],
        set: { ...location, source, confidence: PICKED_CONFIDENCE, updatedAt: new Date() },
      });
  }

  async clearHome(userId: string, tx: Database = this.db): Promise<void> {
    await tx.delete(userLocations).where(and(eq(userLocations.userId, userId), eq(userLocations.kind, HOME_KIND)));
  }
}
