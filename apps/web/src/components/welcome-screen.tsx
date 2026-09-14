import { validateBotUsername } from '../auth/auth-policy';
import { BrandMark } from './brand-mark';
import { CitySilhouette } from './city-silhouette';

export function WelcomeScreen({ serviceUnavailable = false }) {
  const botUsername = validateBotUsername(
    import.meta.env.VITE_TELEGRAM_BOT_USERNAME,
  );

  return (
    <main className="welcome-page safe-page">
      <header className="welcome-header">
        <div className="brand">
          <BrandMark />
          <span>PROJECT EMPIRE</span>
        </div>
        <span className="preview-pill">ÖN İZLEME</span>
      </header>

      <div className="welcome-grid">
        <section className="welcome-copy" aria-labelledby="welcome-title">
          <p className="eyebrow">TELEGRAM’DA YENİ BİR DÜNYA</p>
          <h1 id="welcome-title">
            Şehrini kur.
            <span>İmparatorluğunu büyüt.</span>
          </h1>
          <p className="welcome-lead">
            İşletmelerini geliştir, görevleri tamamla ve arkadaşlarınla aynı
            şehirde yüksel. Yolculuk Telegram’da başlıyor.
          </p>

          <section className="availability-card" aria-labelledby="status-title">
            <div className="status-icon" aria-hidden="true">
              <span />
            </div>
            <div>
              <p className="card-label" id="status-title">
                ŞU ANDA KULLANILAMIYOR
              </p>
              <h2>Telegram’dan açman gerekiyor</h2>
              <p role="status">
                {serviceUnavailable
                  ? 'Bağlantı şu anda kurulamıyor. Biraz sonra Telegram içinden yeniden deneyebilirsin.'
                  : 'Kimliğini güvenli biçimde doğrulamak ve şehrine ulaşmak için oyunu bot üzerinden başlat.'}
              </p>
            </div>
          </section>

          {botUsername ? (
            <a
              className="primary-action"
              href={`https://t.me/${botUsername}?startapp`}
            >
              Telegram’da aç
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <p className="launch-note">
              Telegram açılış bağlantısı hazırlanıyor.
            </p>
          )}

          <p className="trust-note">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5.5 8V6.5a4.5 4.5 0 0 1 9 0V8M4 8h12v9H4V8Z" />
            </svg>
            Profil bilgilerin yalnızca güvenli oturum kurulduğunda gösterilir.
          </p>
        </section>

        <CitySilhouette />
      </div>

      <footer className="welcome-footer">
        <span>© 2026 Project Empire</span>
        <span>Şehrin. Stratejin. İmparatorluğun.</span>
      </footer>
    </main>
  );
}
