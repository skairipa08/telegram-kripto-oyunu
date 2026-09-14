import { z } from 'zod';
import type { TelegramUser } from './crypto';

export const storedSessionSchema = z.object({
  sid: z.uuid(),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  user: z.object({
    id: z.uuid(),
    telegramId: z.string().regex(/^[1-9][0-9]*$/),
    firstName: z.string(),
    username: z.string().nullable(),
    language: z.string().nullable(),
  }),
});
export type StoredSession = z.infer<typeof storedSessionSchema>;
export type LoginResult =
  | { outcome: 'ok'; session: StoredSession }
  | { outcome: 'replay' | 'unavailable' };
export interface AuthStore {
  login(
    user: TelegramUser,
    fingerprint: string,
    requestHash: string,
    authDate: number,
  ): Promise<LoginResult>;
  getSession(sid: string): Promise<StoredSession | null>;
  revoke(sid: string): Promise<void>;
}

export class SupabaseAuthStore implements AuthStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private async rpc(
    name: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Auth storage unavailable');
    return response.json();
  }
  async login(
    user: TelegramUser,
    fingerprint: string,
    requestHash: string,
    authDate: number,
  ): Promise<LoginResult> {
    const data = await this.rpc('empire_auth_login', {
      p_telegram_id: String(user.id),
      p_first_name: user.first_name,
      p_username: user.username ?? null,
      p_language: user.language_code ?? null,
      p_fingerprint: fingerprint,
      p_request_hash: requestHash,
      p_auth_date: authDate,
    });
    const result = z
      .discriminatedUnion('outcome', [
        z.object({ outcome: z.literal('ok'), session: storedSessionSchema }),
        z.object({ outcome: z.enum(['replay', 'unavailable']) }),
      ])
      .parse(data);
    return result;
  }
  async getSession(sid: string) {
    return storedSessionSchema
      .nullable()
      .parse(await this.rpc('empire_auth_session', { p_sid: sid }));
  }
  async revoke(sid: string) {
    await this.rpc('empire_auth_logout', { p_sid: sid });
  }
}
