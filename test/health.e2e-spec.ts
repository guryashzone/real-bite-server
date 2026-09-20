import { Test } from '@nestjs/testing';
import { VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DB } from '../src/common/db/db.constants.js';
import { PinoLogger } from '../src/common/logging/index.js';
import { HealthModule } from '../src/health/health.module.js';

describe('GET /v1/health (e2e)', () => {
  let app: INestApplication<App>;
  const execute = vi.fn();
  const silentLogger = { setContext: () => {}, warn: () => {} };

  beforeEach(async () => {
    execute.mockReset();
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .useMocker((token) => {
        if (token === DB) return { execute };
        if (token === PinoLogger) return silentLogger;
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('is 200 when the database answers', async () => {
    execute.mockResolvedValue({ rows: [] });
    await request(app.getHttpServer()).get('/v1/health').expect(200);
  });

  it('is 503 when the database is down', async () => {
    execute.mockRejectedValue(new Error('connection refused'));
    await request(app.getHttpServer()).get('/v1/health').expect(503);
  });
});
