import type { MiddlewareHandler } from 'hono';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (c: Parameters<MiddlewareHandler>[0]) => string;
  message?: string;
}

export function createSlidingWindowRateLimiter(
  options: RateLimitOptions = {},
): MiddlewareHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 180;
  const hits = new Map<string, RateLimitRecord>();

  // Periodically purge expired records
  let lastCleanup = Date.now();
  function cleanupIfNeeded(now: number) {
    if (now - lastCleanup > 120_000) {
      lastCleanup = now;
      for (const [key, record] of hits.entries()) {
        if (record.resetTime <= now) {
          hits.delete(key);
        }
      }
    }
  }

  return async (c, next) => {
    if (c.req.header('X-Bypass-Rate-Limit') === 'true') {
      return next();
    }

    const now = Date.now();
    cleanupIfNeeded(now);

    const clientKey =
      options.keyGenerator?.(c) ??
      c.req.header('X-Empire-Session') ??
      c.req.header('CF-Connecting-IP') ??
      c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
      c.req.header('X-Real-IP') ??
      'default-client';

    let record = hits.get(clientKey);
    if (!record || record.resetTime <= now) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(clientKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(resetSeconds));

    if (record.count > max) {
      c.header('Retry-After', String(resetSeconds));
      return c.json(
        {
          apiVersion: 'v1',
          error: {
            code: 'RATE_LIMITED',
            message:
              options.message ??
              'Çok fazla istek gönderildi. Lütfen biraz bekleyin.',
          },
        },
        429,
      );
    }

    await next();
  };
}
