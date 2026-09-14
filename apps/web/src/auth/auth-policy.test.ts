import { describe, expect, it } from 'vitest';
import {
  getAuthRecovery,
  isSessionExpired,
  validateBotUsername,
} from './auth-policy';

describe('validateBotUsername', () => {
  it('accepts a BotFather-compatible username', () => {
    expect(validateBotUsername('Empire_GameBot')).toBe('Empire_GameBot');
  });

  it.each(['bot', '@EmpireBot', 'empire-bot', 'a'.repeat(33)])(
    'rejects an unsafe launch-link username: %s',
    (username) => {
      expect(validateBotUsername(username)).toBeNull();
    },
  );
});

describe('isSessionExpired', () => {
  it('expires the session exactly at its server-provided deadline', () => {
    const expiresAt = '2026-09-14T12:00:00.000Z';

    expect(isSessionExpired(expiresAt, Date.parse(expiresAt) - 1)).toBe(false);
    expect(isSessionExpired(expiresAt, Date.parse(expiresAt))).toBe(true);
  });

  it('treats an invalid deadline as expired', () => {
    expect(isSessionExpired('not-a-date', 0)).toBe(true);
  });
});

describe('getAuthRecovery', () => {
  it.each([
    'UNAUTHORIZED',
    'INVALID_INIT_DATA',
    'AUTH_REPLAY',
    'INVALID_REQUEST',
  ])('requires Telegram to be reopened for %s', (code) => {
    expect(getAuthRecovery(code)).toBe('reopen');
  });

  it.each(['ACCOUNT_UNAVAILABLE', 'FORBIDDEN'])(
    'blocks unavailable accounts for %s',
    (code) => {
      expect(getAuthRecovery(code)).toBe('account-unavailable');
    },
  );

  it.each(['AUTH_UNAVAILABLE', 'RATE_LIMITED', 'UNKNOWN'])(
    'allows a later retry for %s',
    (code) => {
      expect(getAuthRecovery(code)).toBe('retry');
    },
  );
});
