import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Env } from '../common/config/env.schema.js';
import { AuditModule } from '../audit/audit.module.js';
import { UsersModule } from '../users/users.module.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthIdentitiesRepository } from './auth-identities.repository.js';
import { AuthSessionsRepository } from './auth-sessions.repository.js';
import { AuthTokensRepository } from './auth-tokens.repository.js';
import { GoogleSignInService } from './google-sign-in.service.js';
import { LoginAttemptsRepository } from './login-attempts.repository.js';
import { LoginService } from './login.service.js';
import { MAIL_SENDER } from './ports/mail-sender.port.js';
import { LoggingMailSender } from './ports/logging-mail-sender.js';
import { PASSWORD_HASHER } from './ports/password-hasher.port.js';
import { Argon2PasswordHasher } from './ports/argon2-password-hasher.js';
import { GOOGLE_TOKEN_VERIFIER } from './ports/google-token-verifier.port.js';
import { GoogleOAuthTokenVerifier } from './ports/google-oauth-token-verifier.js';
import { RegistrationService } from './registration.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';

@Module({
  imports: [
    UsersModule,
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
    // Only `resend-verification` opts into this today (its rate is spec'd explicitly, docs/11 §4);
    // the broader "auth strictest, write, read" profile rollout (docs/02 §4.5) lands with the
    // routes that need it.
    ThrottlerModule.forRoot({
      errorMessage: 'Too many requests. Please try again later.',
      throttlers: [
        { name: 'short', ttl: 60_000, limit: 1 },
        { name: 'long', ttl: 86_400_000, limit: 5 },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthIdentitiesRepository,
    AuthSessionsRepository,
    AuthTokensRepository,
    LoginAttemptsRepository,
    TokenService,
    SessionService,
    RegistrationService,
    LoginService,
    GoogleSignInService,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: MAIL_SENDER, useClass: LoggingMailSender },
    { provide: GOOGLE_TOKEN_VERIFIER, useClass: GoogleOAuthTokenVerifier },
  ],
  // AuthGuard/RolesGuard (APP_GUARD) and other modules read sessions through these.
  exports: [AuthSessionsRepository, TokenService, SessionService],
})
export class AuthModule {}
