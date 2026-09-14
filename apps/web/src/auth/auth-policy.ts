export type AuthRecovery = 'reopen' | 'account-unavailable' | 'retry';

const botUsernamePattern = /^[A-Za-z0-9_]{5,32}$/;

export function validateBotUsername(username: string | undefined) {
  return username && botUsernamePattern.test(username) ? username : null;
}

export function isSessionExpired(expiresAt: string, now = Date.now()) {
  const deadline = Date.parse(expiresAt);
  return !Number.isFinite(deadline) || deadline <= now;
}

export function getAuthRecovery(code: string): AuthRecovery {
  switch (code) {
    case 'UNAUTHORIZED':
    case 'INVALID_INIT_DATA':
    case 'AUTH_REPLAY':
    case 'INVALID_REQUEST':
      return 'reopen';
    case 'ACCOUNT_UNAVAILABLE':
    case 'FORBIDDEN':
      return 'account-unavailable';
    default:
      return 'retry';
  }
}
