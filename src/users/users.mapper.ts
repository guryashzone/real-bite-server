import type { HomeLocationRow } from './user-locations.repository.js';
import type { ProfileRow } from './users.repository.js';

export interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  themePref: string;
  role: string;
  homeLocation: { countryId: string | null; stateId: string | null; cityId: string | null } | null;
  createdAt: Date;
}

export function toMeResponse(profile: ProfileRow, home: HomeLocationRow | undefined): MeResponse {
  return {
    id: profile.id,
    email: profile.email,
    emailVerified: profile.emailVerified,
    displayName: profile.displayName,
    themePref: profile.themePref,
    role: profile.role,
    homeLocation: home ? { countryId: home.countryId, stateId: home.stateId, cityId: home.cityId } : null,
    createdAt: profile.createdAt,
  };
}
