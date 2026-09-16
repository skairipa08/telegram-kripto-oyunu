import { describe, expect, it } from 'vitest';
import { isSafeTelegramInvite } from './friends-screen';

describe('isSafeTelegramInvite', () => {
  it('accepts only the exact credential-free Telegram referral format', () => {
    expect(
      isSafeTelegramInvite('https://t.me/empire_bot?startapp=ref_A1b2'),
    ).toBe(true);

    const unsafeLinks = [
      'http://t.me/empire_bot?startapp=ref_A1b2',
      'https://evil.example/empire_bot?startapp=ref_A1b2',
      'https://t.me.evil.example/empire_bot?startapp=ref_A1b2',
      'https://user:pass@t.me/empire_bot?startapp=ref_A1b2',
      'https://t.me/empire_bot?startapp=ref_A1b2&admin=true',
      'https://t.me/empire_bot?startapp=ref_A1-b2',
      'https://t.me/empire_bot/path?startapp=ref_A1b2',
      'https://t.me/empire_bot?startapp=ref_A1b2#token',
    ];

    for (const link of unsafeLinks) {
      expect(isSafeTelegramInvite(link), link).toBe(false);
    }
  });
});
