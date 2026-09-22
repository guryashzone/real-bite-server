import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './common/config/env.schema.js';
import { DbModule } from './common/db/db.module.js';
import { GlobalExceptionFilter } from './common/errors/index.js';
import { LoggingModule } from './common/logging/index.js';
import { ResponseEnvelopeInterceptor } from './common/response/index.js';
import { GeoModule } from './geo/geo.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    DbModule,
    HealthModule,
    GeoModule,
  ],
  providers: [
    // Every error becomes { success: false, message, error_code, data: {}, details? }; every
    // 2xx becomes { success: true, message, data }. Health opts out (see HealthController).
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
