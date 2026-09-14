import { validateBotUsername } from '../auth/auth-policy';
import type { AuthRecovery } from '../auth/auth-policy';
import { BrandMark } from './brand-mark';

type ReopenScreenProps = {
  recovery: AuthRecovery;
  onRetry: () => void;
  isRetrying: boolean;
};

export function ReopenScreen({
  recovery,
  onRetry,
  isRetrying,
}: ReopenScreenProps) {
  const botUsername = validateBotUsername(
    import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
  );
  const isAccountUnavailable = recovery === 'account-unavailable';
  const canRetry = recovery === 'retry';

  return (
    <main className="centered-page safe-page">
      <section className="message-card" aria-labelledby="message-title">
        <div className="brand">
          <BrandMark />
          <span>PROJECT EMPIRE</span>
        </div>
        <p className="eyebrow">GÜVENLİ OTURUM</p>
        <h1 id="message-title">
          {isAccountUnavailable
            ? 'Bu hesapla devam edilemiyor.'
            : canRetry
              ? 'Bağlantı kurulamadı.'
              : 'Oyunu yeniden aç.'}
        </h1>
        <p>
          {isAccountUnavailable
            ? 'Hesabın şu anda oyun erişimine uygun değil.'
            : canRetry
              ? 'Giriş servisi şu anda hazır değil. Biraz sonra tekrar deneyebilirsin.'
              : 'Oturumun sona erdi veya doğrulanamadı. Devam etmek için oyunu Telegram’dan yeniden başlat.'}
        </p>
        {canRetry ? (
          <button
            type="button"
            className="primary-action"
            onClick={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Deneniyor…' : 'Tekrar dene'}
          </button>
        ) : botUsername && !isAccountUnavailable ? (
          <a
            className="primary-action"
            href={`https://t.me/${botUsername}?startapp`}
          >
            Telegram’da yeniden aç
          </a>
        ) : null}
      </section>
    </main>
  );
}
