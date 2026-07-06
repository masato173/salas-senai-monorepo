import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

interface HealthBody {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
}

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  it('GET /health retorna 200 com status ok', async () => {
    const server: unknown = app.getHttpServer();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const response = await request(server as Parameters<typeof request>[0]).get('/health');
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.0.0-f4.0');
    expect(typeof body.timestamp).toBe('string');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
