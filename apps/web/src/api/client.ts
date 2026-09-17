import { playerStateSchema } from '@empire/shared';
import type { PlayerState } from '@empire/shared';

type ApiErrorBody = {
  apiVersion?: unknown;
  error?: { code?: unknown };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

async function readApiError(response: Response) {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // A generic code keeps malformed server responses out of the UI.
  }

  const code =
    body?.apiVersion === 'v1' && typeof body.error?.code === 'string'
      ? body.error.code
      : 'AUTH_UNAVAILABLE';
  return new ApiError(response.status, code);
}

let activeSessionToken: string | null = null;
try {
  if (typeof window !== 'undefined') {
    activeSessionToken = sessionStorage.getItem('empire_session_token');
  }
} catch {
  // ignore
}

export function setSessionToken(token: string | null) {
  activeSessionToken = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem('empire_session_token', token);
      } else {
        sessionStorage.removeItem('empire_session_token');
      }
    }
  } catch {
    // ignore
  }
}

export function getSessionToken(): string | null {
  if (!activeSessionToken && typeof window !== 'undefined') {
    try {
      activeSessionToken = sessionStorage.getItem('empire_session_token');
    } catch {
      // ignore
    }
  }
  return activeSessionToken;
}

async function request(path: string, init?: RequestInit) {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Empire-Session', token);
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
    signal: AbortSignal.timeout(8000),
  });

  const returnedToken = response.headers.get('x-empire-session');
  if (returnedToken) {
    setSessionToken(returnedToken);
  }

  if (!response.ok) throw await readApiError(response);
  return response;
}

async function readPlayerState(response: Response): Promise<PlayerState> {
  const data = await response.json();
  if (
    data &&
    typeof data === 'object' &&
    'session' in data &&
    data.session &&
    typeof data.session === 'object' &&
    'token' in data.session &&
    typeof data.session.token === 'string'
  ) {
    setSessionToken(data.session.token);
  }
  return playerStateSchema.parse(data);
}

export async function getPlayerState() {
  return readPlayerState(await request('/api/me/state'));
}

export async function authenticateTelegram(
  initData: string,
  requestId: string,
) {
  const response = await request('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, requestId }),
  });
  return readPlayerState(response);
}

export async function logout() {
  try {
    await request('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } finally {
    setSessionToken(null);
  }
}
