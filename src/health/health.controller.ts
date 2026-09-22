import { Controller, Get, Inject, UseFilters } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipEnvelope } from '../common/response/index.js';
import { DatabaseHealthIndicator } from './database.health-indicator.js';
import { HealthUnavailableFilter } from './health-unavailable.filter.js';

/**
 * Opts out of the standard response envelope: this controller's body is exactly what
 * `@nestjs/terminus` returns, on 200 and on 503, because the external uptime check depends on
 * that shape (docs/11 §4). `HealthUnavailableFilter` keeps the 503 body intact; `@SkipEnvelope()`
 * keeps the 200 body intact.
 */
@SkipEnvelope()
@UseFilters(HealthUnavailableFilter)
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
