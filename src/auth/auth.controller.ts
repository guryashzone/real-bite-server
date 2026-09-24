import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { ResponseMessage } from '../common/response/index.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { CurrentUser, type AuthenticatedUser } from './current-user.js';
import { Public } from './decorators/public.decorator.js';
import {
  changePasswordBody,
  forgotPasswordBody,
  googleSignInBody,
  loginBody,
  logoutQuery,
  refreshBody,
  registerBody,
  resendVerificationBody,
  resetPasswordBody,
  verifyEmailBody,
  type ChangePasswordBody,
  type ForgotPasswordBody,
  type GoogleSignInBody,
  type LoginBody,
  type LogoutQuery,
  type RefreshBody,
  type RegisterBody,
  type ResendVerificationBody,
  type ResetPasswordBody,
  type VerifyEmailBody,
} from './dto/auth.schemas.js';
import { GoogleSignInService } from './google-sign-in.service.js';
import { LoginService } from './login.service.js';
import { PasswordChangeService } from './password-change.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { RegistrationService } from './registration.service.js';
import { deviceFromRequest } from './request-device.js';
import { SessionService } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(RegistrationService) private readonly registration: RegistrationService,
    @Inject(LoginService) private readonly loginService: LoginService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(GoogleSignInService) private readonly google: GoogleSignInService,
    @Inject(PasswordResetService) private readonly passwordReset: PasswordResetService,
    @Inject(PasswordChangeService) private readonly passwordChange: PasswordChangeService,
  ) {}

  @Public()
  @Post('google')
  @ResponseMessage('Signed in')
  signInWithGoogle(@Body(new ZodValidationPipe(googleSignInBody)) body: GoogleSignInBody, @Req() req: Request) {
    return this.google.signIn(body.idToken, deviceFromRequest(req));
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If that email is available, a verification code has been sent.')
  async register(@Body(new ZodValidationPipe(registerBody)) body: RegisterBody): Promise<void> {
    await this.registration.register(body);
  }

  @Public()
  @Post('verify-email')
  @ResponseMessage('Email verified')
  verifyEmail(@Body(new ZodValidationPipe(verifyEmailBody)) body: VerifyEmailBody, @Req() req: Request) {
    return this.registration.verifyEmail(body, deviceFromRequest(req));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 1, ttl: 60_000 }, long: { limit: 5, ttl: 86_400_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If that account needs verifying, a new code has been sent.')
  async resendVerification(
    @Body(new ZodValidationPipe(resendVerificationBody)) body: ResendVerificationBody,
  ): Promise<void> {
    await this.registration.resendVerification(body.email);
  }

  @Public()
  @Post('login')
  @ResponseMessage('Signed in')
  login(@Body(new ZodValidationPipe(loginBody)) body: LoginBody, @Req() req: Request) {
    return this.loginService.login(body, deviceFromRequest(req));
  }

  @Public()
  @Post('refresh')
  @ResponseMessage('Session refreshed')
  refresh(@Body(new ZodValidationPipe(refreshBody)) body: RefreshBody, @Req() req: Request) {
    return this.sessions.rotate(body.refreshToken, deviceFromRequest(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Signed out')
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(logoutQuery)) query: LogoutQuery,
  ): Promise<void> {
    if (query.all) {
      await this.sessions.revokeAllForUser(user.id);
    } else {
      await this.sessions.revoke(user.sessionId);
    }
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordBody)) body: ForgotPasswordBody): Promise<void> {
    await this.passwordReset.forgotPassword(body.email);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset. Please sign in again.')
  async resetPassword(@Body(new ZodValidationPipe(resetPasswordBody)) body: ResetPasswordBody): Promise<void> {
    await this.passwordReset.resetPassword(body);
  }

  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password changed')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordBody)) body: ChangePasswordBody,
  ): Promise<void> {
    await this.passwordChange.change(user.id, body);
  }
}
