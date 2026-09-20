import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './common/config/env.schema.js';
import { DbModule } from './common/db/db.module.js';
import { LoggingModule } from './common/logging/index.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    DbModule,
    HealthModule,
  ],
})
export class AppModule {}
