import { getSessionToken, setSessionToken } from './client';

export function setupFetchInterceptor() {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = '';
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input && typeof input === 'object' && 'url' in input) {
      url = input.url;
    }

    const isApiRequest =
      url.startsWith('/api') ||
      url.startsWith('api/') ||
      url.includes('/api/') ||
      url.startsWith('/me') ||
      url.startsWith('/economy') ||
      url.startsWith('/missions') ||
      url.startsWith('/streak') ||
      url.startsWith('/leaderboard') ||
      url.startsWith('/shop') ||
      url.startsWith('/combo') ||
      url.startsWith('/clans') ||
      url.startsWith('/arcade');

    if (isApiRequest) {
      const token = getSessionToken();
      const headers = new Headers(init?.headers);
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (token && !headers.has('X-Empire-Session')) {
        headers.set('X-Empire-Session', token);
      }
      const response = await originalFetch(input, {
        ...init,
        credentials: init?.credentials ?? 'include',
        headers,
      });

      const returnedToken = response.headers.get('x-empire-session');
      if (returnedToken) {
        setSessionToken(returnedToken);
      }

      return response;
    }

    return originalFetch(input, init);
  };
}
