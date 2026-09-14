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
});
