import type { PlaceRef } from './place-ref.js';
import type { ProfileRow } from './users.repository.js';

export interface MeResponse {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  themePref: string;
  role: string;
  homeLocation: PlaceRef | null;
  createdAt: Date;
}

export function toMeResponse(profile: ProfileRow, home: PlaceRef | undefined): MeResponse {
  return {
    id: profile.id,
    email: profile.email,
    emailVerified: profile.emailVerified,
    displayName: profile.displayName,
    themePref: profile.themePref,
    role: profile.role,
    homeLocation: home ?? null,
    createdAt: profile.createdAt,
  };
}
