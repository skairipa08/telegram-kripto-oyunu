import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { healthResponseSchema } from '@empire/shared';
import './styles.css';

const queryClient = new QueryClient();

async function getHealth() {
  const response = await fetch('/api/health', {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Sunucuya ulaşılamadı.');
  return healthResponseSchema.parse(await response.json());
}

function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: false,
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center px-6 py-12">
      <p className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
        Project Empire
      </p>
      <h1 className="text-4xl font-semibold leading-tight">
        İmparatorluğun
        <br />
        burada başlayacak.
      </h1>
      <p className="mt-5 leading-relaxed text-slate-300">
        İşletmelerini büyüt, arkadaşlarınla sezonlarda yarış. Telegram içindeki
        yeni oyun dünyasının temeli hazırlanıyor.
      </p>
      <section
        className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6"
        aria-labelledby="status-title"
      >
        <h2 id="status-title" className="font-semibold">
          Geliştirme ortamı
        </h2>
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-slate-300"
        >
          {health.isPending
            ? 'Sunucu bağlantısı kontrol ediliyor…'
            : health.isError
              ? 'Sunucu bağlantısı kurulamadı.'
              : 'Sunucu bağlantısı hazır.'}
        </p>
        {health.isError && (
          <button
            type="button"
            className="mt-4 min-h-11 rounded-lg bg-emerald-300 px-4 font-medium text-slate-950"
            onClick={() => void health.refetch()}
          >
            Tekrar dene
          </button>
        )}
        <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400">
          Bu başlangıç ekranıdır. Telegram girişi ve oynanabilir ekonomi sonraki
          geliştirme adımlarında eklenecek.
        </p>
      </section>
      <p className="mt-8 text-xs text-slate-400">
        İşletmeler · Görevler · Arkadaşlar · Sezonlar
      </p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing.');
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
