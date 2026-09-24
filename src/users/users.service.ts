import { Inject, Injectable } from '@nestjs/common';
import { TransactionRunner } from '../common/db/transaction-runner.js';
import { DomainException } from '../common/errors/index.js';
import { ConsentsRepository } from './consents.repository.js';
import type { PatchMeBody, SetConsentBody } from './dto/users.schemas.js';
import { UserLocationsRepository } from './user-locations.repository.js';
import { toMeResponse, type MeResponse } from './users.mapper.js';
import { UsersRepository } from './users.repository.js';

class UserNotFoundException extends DomainException {
  readonly code = 'user_not_found';
  readonly status = 404;
  constructor() {
    super('User not found.');
  }
}

/** `GET/PATCH /v1/me` and `/v1/me/consents` (docs/11 §4). Account deletion is a separate
 * controller in `auth` — it needs `SessionService`/`AuthIdentitiesRepository`, which `users`
 * (layer 2) can't import from `auth` (layer 3, docs/02 §4.1). */
@Injectable()
export class UsersService {
  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(UserLocationsRepository) private readonly locations: UserLocationsRepository,
    @Inject(ConsentsRepository) private readonly consents: ConsentsRepository,
    @Inject(TransactionRunner) private readonly transactions: TransactionRunner,
  ) {}

  async getMe(userId: string): Promise<MeResponse> {
    const profile = await this.users.findProfileById(userId);
    if (!profile) throw new UserNotFoundException();
    const home = await this.locations.findHome(userId);
    return toMeResponse(profile, home);
  }

  async updateMe(userId: string, patch: PatchMeBody): Promise<MeResponse> {
    return this.transactions.run(async (tx) => {
      await this.users.updateProfile(userId, { displayName: patch.displayName, themePref: patch.themePref }, tx);

      if (patch.homeLocation === null) {
        await this.locations.clearHome(userId, tx);
      } else if (patch.homeLocation) {
        await this.locations.setHome(
          userId,
          {
            countryId: patch.homeLocation.countryId ?? null,
            stateId: patch.homeLocation.stateId ?? null,
            cityId: patch.homeLocation.cityId ?? null,
          },
          tx,
        );
      }

      const profile = await this.users.findProfileById(userId, tx);
      if (!profile) throw new UserNotFoundException();
      const home = await this.locations.findHome(userId, tx);
      return toMeResponse(profile, home);
    });
  }

  async setConsent(userId: string, input: SetConsentBody): Promise<void> {
    if (input.granted) {
      const active = await this.consents.findActive(userId, input.kind);
      if (active?.version === input.version) return; // Already granted at this version.
      if (active) await this.consents.revokeActive(userId, input.kind);
      await this.consents.grant(userId, input.kind, input.version);
    } else {
      await this.consents.revokeActive(userId, input.kind);
    }
  }
}
