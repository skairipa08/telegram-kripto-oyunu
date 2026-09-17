import { describe, expect, it } from 'vitest';
import app from './index';
import { healthResponseSchema } from '@empire/shared';

describe('API boundary', () => {
  it('provides a public versioned liveness response without credentials', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(healthResponseSchema.parse(await response.json())).toEqual({
      apiVersion: 'v1',
      status: 'ok',
      service: 'empire-api',
    });
  });

  it('returns structured 404 errors for unimplemented routes', async () => {
    const response = await app.request('/does-not-exist');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      apiVersion: 'v1',
      error: { code: 'NOT_FOUND' },
    });
  });

  it('includes security headers in API responses', async () => {
    const response = await app.request('/health');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('rejects oversized payloads with 413 Payload Too Large', async () => {
    const hugePayload = 'A'.repeat(300 * 1024); // 300KB > 256KB limit
    const response = await app.request('/api/clans/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ huge: hugePayload }),
    });
    expect(response.status).toBe(413);
    const data = (await response.json()) as { error?: { code?: string } };
    expect(data.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('enforces rate limiting on sensitive endpoints when flood occurs', async () => {
    const ip = '198.51.100.55';
    let lastStatus = 200;
    // Sensitive limit is 30 req/min
    for (let i = 0; i < 35; i++) {
      const res = await app.request('/api/clans/create', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': ip,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Test' }),
      });
      lastStatus = res.status;
      if (res.status === 429) {
        expect(res.headers.get('Retry-After')).toBeDefined();
        const body = (await res.json()) as { error?: { code?: string } };
        expect(body.error?.code).toBe('RATE_LIMITED');
        break;
      }
    }
    expect(lastStatus).toBe(429);
  });
});
