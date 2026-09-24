import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './common/config/env.schema.js';
import { DbModule } from './common/db/db.module.js';
import { GlobalExceptionFilter } from './common/errors/index.js';
import { LoggingModule } from './common/logging/index.js';
import { ResponseEnvelopeInterceptor } from './common/response/index.js';
import { AuthModule } from './auth/auth.module.js';
import { AuthGuard } from './auth/guards/auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { GeoModule } from './geo/geo.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    DbModule,
    HealthModule,
    AuthModule,
    GeoModule,
  ],
  providers: [
    // Every error becomes { success: false, message, error_code, data: {}, details? }; every
    // 2xx becomes { success: true, message, data }. Health opts out (see HealthController).
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    // Default-deny (docs/02 §4.5): every route needs a valid session unless `@Public()`.
    // RolesGuard runs after AuthGuard (registration order) and checks `@Roles()` if present.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
