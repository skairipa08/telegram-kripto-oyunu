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
  if (
    !bot ||
    !secret ||
    new TextEncoder().encode(secret).length < 32 ||
    !origin
  )
    return null;

  const isDev =
    (env as Record<string, unknown>).DEV_AUTH_BYPASS === 'true' || !url;
  const limiter =
    env.AUTH_RATE_LIMIT ??
    (isDev ? { limit: async () => ({ success: true }) } : undefined);
  if (!limiter) return null;

  try {
    const app = new URL(origin);
    const isLocal =
      app.hostname === 'localhost' ||
      app.hostname === '127.0.0.1' ||
      app.hostname.endsWith('.ngrok-free.dev') ||
      app.hostname.endsWith('.ngrok-free.app') ||
      app.hostname.endsWith('.ngrok.io') ||
      app.hostname.endsWith('.ngrok.app');

    if (
      (app.protocol !== 'https:' && !isLocal) ||
      app.origin !== origin ||
      app.username ||
      app.password
    )
      return null;

    if (url) {
      const database = new URL(url);
      if (
        database.protocol !== 'https:' ||
        database.origin !== url ||
        database.username ||
        database.password
      )
        return null;
    } else if (!isDev) {
      return null;
    }
  } catch {
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
