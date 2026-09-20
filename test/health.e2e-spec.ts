import { Test } from '@nestjs/testing';
import { VersioningType, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DB } from '../src/common/db/db.constants.js';
import { PinoLogger } from '../src/common/logging/index.js';
import { HealthModule } from '../src/health/health.module.js';
import { createFakePinoLogger } from './fakes/fake-pino-logger.js';

describe('health (e2e)', () => {
  let app: INestApplication<App>;
  const execute = vi.fn();

  beforeEach(async () => {
    execute.mockReset();
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .useMocker((token) => {
        if (token === DB) return { execute };
        if (token === PinoLogger) return createFakePinoLogger();
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('ready: 200 when the database answers (on both paths)', async () => {
    execute.mockResolvedValue({ rows: [] });
    for (const path of ['/v1/health', '/v1/health/ready']) {
      const res = await request(app.getHttpServer()).get(path).expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info.database.status).toBe('up');
    }
  });

  it('ready: 503 when the database is down', async () => {
    execute.mockRejectedValue(new Error('connection refused'));
    const res = await request(app.getHttpServer())
      .get('/v1/health')
      .expect(503);
    expect(res.body.status).toBe('error');
    expect(res.body.error.database).toEqual({
      status: 'down',
      message: 'database unreachable',
    });
  });

  it('live: 200 and never touches the database', async () => {
    execute.mockRejectedValue(new Error('connection refused'));
    await request(app.getHttpServer())
      .get('/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('is not served without the version prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
