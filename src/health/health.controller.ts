import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health-indicator.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(DatabaseHealthIndicator)
    private readonly database: DatabaseHealthIndicator,
  ) {}

  /** Liveness: the process answers. Never touches the database (Docker healthcheck). */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /**
   * Readiness: 503 when a dependency is down. This is the URL the external
   * uptime check watches (docs/11 §7.3). `/v1/health` and `/v1/health/ready`
   * are the same handler.
   */
  @Get(['', 'ready'])
  @HealthCheck()
  ready() {
    return this.health.check([() => this.database.isHealthy('database')]);
  }
}
