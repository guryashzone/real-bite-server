import { Module } from '@nestjs/common';
import { ConsentsRepository } from './consents.repository.js';
import { UserLocationsRepository } from './user-locations.repository.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersRepository, UserLocationsRepository, ConsentsRepository, UsersService],
  // `auth` needs UsersRepository to create/read users; everything else here is `/v1/me`'s own.
  exports: [UsersRepository],
})
export class UsersModule {}
