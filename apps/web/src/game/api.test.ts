import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGameResource } from './api';
import { healthResponseSchema } from '@empire/shared';

afterEach(() => vi.unstubAllGlobals());
describe('game read boundary', () => {
  it('reads authenticated JSON through the supplied contract', async () => {
    let options: RequestInit | undefined;
    vi.stubGlobal('fetch', async (_input: unknown, init: RequestInit) => {
      options = init;
      return Response.json({
        apiVersion: 'v1',
        status: 'ok',
        service: 'empire-api',
      });
    });
    expect(
      (await getGameResource('/api/health', healthResponseSchema)).status,
    ).toBe('ok');
    expect(options?.credentials).toBe('same-origin');
    expect(options?.method ?? 'GET').toBe('GET');
  });
  it('rejects malformed state instead of inventing fallback balances', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json({ status: 'ok', cash: 999999 }),
    );
    await expect(
      getGameResource('/api/health', healthResponseSchema),
    ).rejects.toThrow();
  });
  it('keeps authentication failure distinct from a missing feature', async () => {
    vi.stubGlobal('fetch', async () =>
      Response.json(
        { apiVersion: 'v1', error: { code: 'UNAUTHORIZED' } },
        { status: 401 },
      ),
    );
    await expect(
      getGameResource('/api/health', healthResponseSchema),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });
});
