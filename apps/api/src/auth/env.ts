export interface Bindings {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  SESSION_SECRET?: string;
  APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
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
    !origin ||
    !url ||
    !key ||
    !env.AUTH_RATE_LIMIT
  )
    return null;
  try {
    const app = new URL(origin);
    const database = new URL(url);
    if (
      app.protocol !== 'https:' ||
      app.origin !== origin ||
      app.username ||
      app.password
    )
      return null;
    if (
      database.protocol !== 'https:' ||
      database.origin !== url ||
      database.username ||
      database.password
    )
      return null;
  } catch {
    return null;
  }
  return { bot, secret, origin, url, key, limiter: env.AUTH_RATE_LIMIT };
}
