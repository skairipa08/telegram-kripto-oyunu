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

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw await readApiError(response);
  return response;
}

async function readPlayerState(response: Response): Promise<PlayerState> {
  return playerStateSchema.parse(await response.json());
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
  await request('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}
