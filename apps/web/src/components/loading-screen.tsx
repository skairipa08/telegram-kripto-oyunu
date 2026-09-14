import { BrandMark } from './brand-mark';

export function LoadingScreen() {
  return (
    <main className="centered-page safe-page" aria-busy="true">
      <section className="loading-card" aria-label="Oyun hazırlanıyor">
        <div className="brand brand-centered">
          <BrandMark />
          <span>PROJECT EMPIRE</span>
        </div>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line skeleton-short" />
        <p role="status" aria-live="polite">
          Güvenli oturumun hazırlanıyor…
        </p>
      </section>
    </main>
  );
}
