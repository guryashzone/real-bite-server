import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';

/**
 * Just the repository for now: `auth` needs it to create and read users. The `/v1/me` controller
 * and service land in a later PR, in this same module.
 */
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
