import { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createApp } from '../app';

describe('Health', () => {
  const app = createApp();

  it('returns API root metadata', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('SmartSched API');
  });

  it('returns health check', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('Auth validation', () => {
  const app = createApp();

  it('rejects invalid login payload', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// silence unused import lint in some configs
export type _Express = { Request: Request; Response: Response; NextFunction: NextFunction };
