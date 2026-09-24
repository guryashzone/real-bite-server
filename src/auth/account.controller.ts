import { Controller, Delete, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ResponseMessage } from '../common/response/index.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { CurrentUser, type AuthenticatedUser } from './current-user.js';

/** Just `DELETE /v1/me` — see `AccountDeletionService` for why this lives in `auth` rather than
 * alongside the rest of `/v1/me` in `users`. */
@Controller('me')
export class AccountController {
  constructor(@Inject(AccountDeletionService) private readonly deletion: AccountDeletionService) {}

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Account deletion started')
  async deleteAccount(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.deletion.deleteAccount(user.id);
  }
}
