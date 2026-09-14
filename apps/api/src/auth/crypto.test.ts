import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateInitData, signSession, verifySession } from './crypto';

const bot = '123456:unit-test-bot-secret';
const secret = 'test-only-random-session-secret-32-characters';
const now = 1800000000;
const user = JSON.stringify({
  id: 123456789,
  first_name: 'Ada',
  username: 'ada',
});

// Independent Node crypto fixture, not production signing code.
function fixture(fields: Record<string, string> = {}, token = bot) {
  const entries = {
    auth_date: String(now),
    user,
    query_id: 'AA-test',
    ...fields,
  };
  const check = Object.entries(entries)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({
    ...entries,
    hash: createHmac('sha256', key).update(check).digest('hex'),
  }).toString();
}

describe('Telegram signature boundary', () => {
  it('accepts a correctly signed Telegram user, including optional signature field', async () => {
    const result = await validateInitData(
      fixture({ signature: 'signed-extra-field' }),
      bot,
      now,
    );
    expect(result.user.id).toBe(123456789);
    expect(result.user.first_name).toBe('Ada');
  });
  it('does not trust a modified user, wrong bot, or malformed hash', async () => {
    for (const raw of [
      fixture().replace('Ada', 'Eve'),
      fixture({}, 'wrong:token'),
      fixture().replace(/hash=[^&]+/, 'hash=zz'),
    ]) {
      await expect(validateInitData(raw, bot, now)).rejects.toThrow();
    }
  });
  it('rejects stale and future data but accepts the freshness boundary', async () => {
    await expect(
      validateInitData(fixture({ auth_date: String(now - 300) }), bot, now),
    ).resolves.toBeDefined();
    for (const auth_date of [
      String(now - 301),
      String(now + 31),
      '1e9',
      'not-time',
    ]) {
      await expect(
        validateInitData(fixture({ auth_date }), bot, now),
      ).rejects.toThrow();
    }
  });
  it('rejects ambiguous parameters, bad percent encoding and oversized input', async () => {
    for (const raw of [
      fixture() + '&user=x',
      fixture() + '&%75ser=x',
      fixture() + '&extra=%ZZ',
      'a'.repeat(16385),
    ]) {
      await expect(validateInitData(raw, bot, now)).rejects.toThrow();
    }
  });
  it('rejects bot accounts, invalid ids and non-object user data', async () => {
    for (const value of [
      { id: 0, first_name: 'A' },
      { id: Number.MAX_SAFE_INTEGER + 1, first_name: 'A' },
      { id: 1, first_name: 'A', is_bot: true },
      'bad',
      [],
    ]) {
      await expect(
        validateInitData(fixture({ user: JSON.stringify(value) }), bot, now),
      ).rejects.toThrow();
    }
  });
  it('uses canonical content for replay identity regardless of encoding or parameter order', async () => {
    const raw = fixture();
    const reordered = raw
      .split('&')
      .reverse()
      .join('&')
      .replace('Ada', '%41da');
    expect((await validateInitData(raw, bot, now)).fingerprint).toBe(
      (await validateInitData(reordered, bot, now)).fingerprint,
    );
  });
});

describe('signed session', () => {
  const session = {
    sid: '11b1a892-558f-4d13-8116-de94679587be',
    iat: now,
    exp: now + 1800,
  };
  it('accepts valid session and rejects tampering, wrong secret and expiry', async () => {
    const signed = await signSession(session, secret);
    expect(await verifySession(signed, secret, now)).toEqual(session);
    for (const [token, key, time] of [
      [signed + 'x', secret, now],
      [signed, 'x'.repeat(32), now],
      [signed, secret, now + 1800],
    ] as const) {
      await expect(verifySession(token, key, time)).rejects.toThrow();
    }
  });
  it('rejects malformed or overlong tokens and weak signing configuration', async () => {
    for (const token of ['abc', 'a.b.c', 'x'.repeat(2049)])
      await expect(verifySession(token, secret, now)).rejects.toThrow();
    await expect(signSession(session, 'short')).rejects.toThrow();
  });
});
