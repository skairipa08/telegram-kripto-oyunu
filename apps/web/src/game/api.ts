import { ApiError } from '../api/client';

export async function getGameResource<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  signal?: AbortSignal,
): Promise<T> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
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
