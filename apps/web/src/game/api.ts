import { ApiError, getSessionToken, setSessionToken } from '../api/client';

export async function getGameResource<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(8000);
  const token = getSessionToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Empire-Session'] = token;
  }

  const response = await fetch(path, {
    credentials: 'same-origin',
    headers,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  const returnedToken = response.headers.get('x-empire-session');
  if (returnedToken) {
    setSessionToken(returnedToken);
  }

  if (!response.ok) {
    let code = 'UNAVAILABLE';
    try {
      const body = await response.json();
      if (typeof body?.error?.code === 'string') code = body.error.code;
    } catch {
      /* Keep raw server errors out of the UI. */
    }
    throw new ApiError(response.status, code);
  }
  return schema.parse(await response.json());
}
