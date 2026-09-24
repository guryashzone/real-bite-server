import { Body, Controller, Get, Inject, Patch, Post } from '@nestjs/common';
import { ResponseMessage } from '../common/response/index.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.js';
import { patchMeBody, setConsentBody, type PatchMeBody, type SetConsentBody } from './dto/users.schemas.js';
import { UsersService } from './users.service.js';

@Controller('me')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  @ResponseMessage('Profile retrieved')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getMe(user.id);
  }

  @Patch()
  @ResponseMessage('Profile updated')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(patchMeBody)) body: PatchMeBody) {
    return this.users.updateMe(user.id, body);
  }

  @Post('consents')
  @ResponseMessage('Consent recorded')
  async setConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(setConsentBody)) body: SetConsentBody,
  ): Promise<void> {
    await this.users.setConsent(user.id, body);
  }
}
