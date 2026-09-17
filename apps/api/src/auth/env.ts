export interface Bindings {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  SESSION_SECRET?: string;
  APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  DEV_AUTH_BYPASS?: string;
  AUTH_RATE_LIMIT?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
export function authConfig(env: Bindings) {
  const {
    TELEGRAM_BOT_TOKEN: bot,
    SESSION_SECRET: secret,
    APP_ORIGIN: origin,
    SUPABASE_URL: url,
    SUPABASE_SERVICE_ROLE_KEY: key,
  } = env;

  const secretLen = secret ? new TextEncoder().encode(secret).length : 0;
  console.log('[DEBUG authConfig]', {
    hasBot: !!bot,
    hasSecret: !!secret,
    secretLen,
    origin,
    url,
    hasLimiter: !!env.AUTH_RATE_LIMIT,
    devBypass: (env as Record<string, unknown>).DEV_AUTH_BYPASS,
  });

  if (!bot || !secret || secretLen < 32 || !origin) {
    console.log('[DEBUG authConfig FAIL 0] basic fields check failed!', {
      hasBot: !!bot,
      hasSecret: !!secret,
      secretLen,
      origin,
    });
    return null;
  }

  const isDev =
    (env as Record<string, unknown>).DEV_AUTH_BYPASS === 'true' ||
    !url ||
    !env.AUTH_RATE_LIMIT;
  const limiter = env.AUTH_RATE_LIMIT ?? {
    limit: async () => ({ success: true }),
  };
  if (!limiter) return null;

  try {
    const app = new URL(origin);
    const isLocal =
      app.hostname === 'localhost' ||
      app.hostname === '127.0.0.1' ||
      app.hostname.endsWith('.ngrok-free.dev') ||
      app.hostname.endsWith('.ngrok-free.app') ||
      app.hostname.endsWith('.ngrok.io') ||
      app.hostname.endsWith('.ngrok.app') ||
      app.hostname.endsWith('.trycloudflare.com') ||
      app.hostname.endsWith('.pages.dev') ||
      app.hostname.endsWith('.vercel.app');

    if (
      (app.protocol !== 'https:' && !isLocal) ||
      app.origin !== origin ||
      app.username ||
      app.password
    ) {
      console.log('[DEBUG authConfig FAIL 1] app check', {
        protocol: app.protocol,
        isLocal,
        appOrigin: app.origin,
        origin,
      });
      return null;
    }

    if (url) {
      const database = new URL(url);
      if (
        database.protocol !== 'https:' ||
        database.origin !== url ||
        database.username ||
        database.password
      ) {
        console.log('[DEBUG authConfig FAIL 2] db check', {
          dbProtocol: database.protocol,
          dbOrigin: database.origin,
          url,
        });
        return null;
      }
    } else if (!isDev) {
      console.log('[DEBUG authConfig FAIL 3] not dev and no url');
      return null;
    }
  } catch (err) {
    console.log('[DEBUG authConfig CATCH]', err);
    return null;
  }
  return {
    bot,
    secret,
    origin,
    url: url ?? '',
    key: key ?? '',
    limiter,
  };
}
