import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app';
import { setupFetchInterceptor } from './api/auth-fetch';
import './styles.css';

setupFetchInterceptor();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing.');
// No preview entry or sample data is included in the production bundle.
const Preview = import.meta.env.DEV
  ? lazy(() =>
      import('./preview/design-preview').then((module) => ({
        default: module.DesignPreview,
      })),
    )
  : null;
const showPreview =
  import.meta.env.DEV && window.location.pathname === '/design-preview';
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {showPreview && Preview ? (
        <Suspense fallback={<p role="status">Tasarım yükleniyor…</p>}>
          <Preview />
        </Suspense>
      ) : (
        <App />
      )}
    </QueryClientProvider>
  </React.StrictMode>,
);
