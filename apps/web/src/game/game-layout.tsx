import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameTab } from './types';
import { Icon } from '../components/icons';
import { AnimatedCounter } from '../components/animated-counter';
import { useI18n } from '../i18n/i18n-context';
import { LanguageSelector } from '../i18n/language-selector';

export function GameLayout({
  tab,
  onTab,
  name,
  cash,
  points,
  level,
  children,
  preview = false,
  onLogout,
  isLoggingOut = false,
  logoutFailed = false,
  isAdmin = false,
  onOpenAdmin,
}: {
  tab: GameTab;
  onTab: (tab: GameTab) => void;
  name: string;
  cash: number | null;
  points: number | null;
  level?: number | null;
  children: ReactNode;
  preview?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  logoutFailed?: boolean;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
}) {
  const { t } = useI18n();

  const tabs: { key: GameTab; label: string; short: string }[] = [
    { key: 'empire', label: t('nav_empire'), short: t('nav_empire') },
    { key: 'arcade', label: t('nav_arcade'), short: t('nav_arcade') },
    { key: 'missions', label: t('nav_missions'), short: t('nav_missions') },
    { key: 'friends', label: t('nav_friends'), short: t('nav_friends') },
    { key: 'leaderboard', label: t('nav_leaderboard'), short: t('nav_leaderboard') },
    { key: 'shop', label: t('nav_shop'), short: t('nav_shop') },
  ];

  const [accountOpen, setAccountOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousTab = useRef(tab);
  useEffect(() => {
    if (previousTab.current !== tab) {
      mainRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
      previousTab.current = tab;
    }
  }, [tab]);
  useEffect(() => {
    if (accountOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [accountOpen]);
  const totalLevel =
    level !== undefined && level !== null
      ? level
      : cash !== null || points !== null
        ? Math.max(1, Math.floor((points ?? 0) / 100) + 1)
        : 0;

  return (
    <div className="empire-app">
      <a className="skip-link" href="#game-content">
        İçeriğe geç
      </a>
      <aside className="desktop-rail">
        <a
          className="wordmark"
          href={preview ? '/design-preview' : '/'}
          aria-label="Empire ana sayfa"
        >
          <span className="wordmark-symbol" aria-hidden="true">
            E<span>.</span>
          </span>
          <span>
            EMPIRE<small>BUILD YOUR LEGACY</small>
          </span>
        </a>
        <p className="rail-label">{t('header_play_zone')}</p>
        <nav aria-label="Ana menü" className="desktop-navigation">
          {tabs.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? 'rail-link active' : 'rail-link'}
              aria-current={tab === item.key ? 'page' : undefined}
              onClick={() => onTab(item.key)}
            >
              <Icon name={item.key} />
              <span>{item.label}</span>
              {tab === item.key && <span className="nav-indicator" />}
            </button>
          ))}
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              className="rail-link admin-rail-link"
              onClick={onOpenAdmin}
              aria-label="Yönetici Paneli"
            >
              <span aria-hidden="true">🛡️</span>
              <span>{t('nav_admin')}</span>
            </button>
          )}
        </nav>
        <div className="rail-bottom">
          <div style={{ marginBottom: '10px' }}>
            <LanguageSelector />
          </div>
          <div className="rail-quote">
            <span aria-hidden="true">✧</span>
            <p>
              Büyük fikirler.
              <br />
              <strong>Küçük başlangıçlar.</strong>
            </p>
          </div>
          <button
            className="account-button"
            onClick={() => setAccountOpen(true)}
          >
            <span className="avatar">{name.trim().charAt(0) || 'E'}</span>
            <span>
              {name}
              <small>{preview ? 'Örnek oyuncu' : 'Telegram hesabı'}</small>
            </span>
            <span aria-hidden="true">···</span>
          </button>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <div className="mobile-brand">
            EMPIRE<span>.</span>
          </div>
          <div className="topbar-breadcrumb">
            {t('header_play_zone')} <span>/</span> {tabs.find((t) => t.key === tab)?.label}
          </div>
          <div className="wallet-strip" aria-label="Bakiyeler">
            <span className="wallet-pill wallet-cash">
              <i aria-hidden="true" className="cash-dot" />{' '}
              <AnimatedCounter value={cash} compact showSparksOnIncrease />
              <small>{t('header_cash')}</small>
            </span>
            <span className="wallet-pill wallet-points">
              <i aria-hidden="true" className="point-dot" />{' '}
              <AnimatedCounter
                value={points}
                compact
                showSparksOnIncrease={false}
              />
              <small>{t('header_season_points')}</small>
            </span>
            {totalLevel > 0 && (
              <span
                className="wallet-pill wallet-level-badge"
                title="Toplam İmparatorluk Seviyesi"
              >
                <i aria-hidden="true" className="level-dot">
                  👑
                </i>{' '}
                <strong className="level-text">Lv.{totalLevel}</strong>
                <small>{t('header_level')}</small>
              </span>
            )}
          </div>
          <LanguageSelector />
          {isAdmin && onOpenAdmin && (
            <button
              type="button"
              className="admin-topbar-link"
              onClick={onOpenAdmin}
              aria-label="Yönetici Paneli"
              style={{
                background: 'rgba(225, 180, 126, 0.15)',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                borderRadius: '999px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🛡️ Admin
            </button>
          )}
          <button
            className="mobile-account avatar"
            aria-label="Hesabı aç"
            onClick={() => setAccountOpen(true)}
          >
            {name.trim().charAt(0) || 'E'}
          </button>
        </header>
        <div className="workspace-grid">
          <main
            id="game-content"
            ref={mainRef}
            tabIndex={-1}
            className="game-content"
          >
            <div key={tab} className="screen-transition-pane">
              {children}
            </div>
          </main>
          <aside className="context-sidebar" aria-label="Oyun rehberi">
            <p className="eyebrow">İMPARATORLUK NOTLARI</p>
            <h2>
              Her gün,
              <br />
              bir adım ileri.
            </h2>
            <div className="context-line" />
            <article>
              <span>01</span>
              <div>
                <h3>Üret, topla, geliştir</h3>
                <p>
                  İşletmelerin sen yokken de çalışır. Geri dön ve bir sonraki
                  hamleni yap.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Birlikte büyü</h3>
                <p>
                  Davet ödülleri, arkadaşların oyuna katılıp geri döndükçe
                  açılır.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Kendi ritminde oyna</h3>
                <p>
                  Nakit ve sezon puanları oyunla kazanılır. Mağaza kolaylık ve
                  görünüm sunar.
                </p>
              </div>
            </article>
            <div className="context-emblem" aria-hidden="true">
              <svg viewBox="0 0 180 140">
                <path d="M16 112 90 135l74-23V53L90 8 16 53z" />
                <path d="m16 53 74 30 74-30M90 83v52M42 63V43l26-16v46m39 4V38l28 17v11" />
              </svg>
            </div>
          </aside>
        </div>
      </div>
      <nav className="mobile-navigation" aria-label="Oyun bölümleri">
        {tabs.map((item) => (
          <button
            key={item.key}
            className={
              tab === item.key ? 'mobile-nav-item active' : 'mobile-nav-item'
            }
            aria-current={tab === item.key ? 'page' : undefined}
            onClick={() => onTab(item.key)}
          >
            <Icon name={item.key} />
            <span>{item.short}</span>
            {tab === item.key && (
              <>
                <span className="nav-halo" aria-hidden="true" />
                <span className="nav-underbar" aria-hidden="true" />
              </>
            )}
          </button>
        ))}
      </nav>
      <dialog
        ref={dialogRef}
        onClose={() => setAccountOpen(false)}
        onCancel={() => setAccountOpen(false)}
        className="account-dialog"
      >
        <div className="dialog-title">
          <h2>{t('header_account')}</h2>
          <button
            className="icon-button"
            onClick={() => setAccountOpen(false)}
            aria-label={t('btn_close')}
          >
            ×
          </button>
        </div>
        <span className="avatar large">{name.trim().charAt(0) || 'E'}</span>
        <h3>{name}</h3>
        <p className="muted">
          {preview
            ? 'Bu oyuncu yalnız tasarım önizlemesine aittir.'
            : `${t('header_connected_as')} Telegram`}
        </p>
        {isAdmin && onOpenAdmin && (
          <button
            type="button"
            className="button primary admin-dialog-entry"
            style={{ width: '100%', marginBottom: '12px' }}
            onClick={() => {
              setAccountOpen(false);
              onOpenAdmin();
            }}
          >
            🛡️ {t('nav_admin')}
          </button>
        )}
        {onLogout && (
          <button
            className="button secondary"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? t('header_logging_out') : t('header_logout')}
          </button>
        )}
        {logoutFailed && <p role="alert">Çıkış tamamlanamadı. Tekrar dene.</p>}
      </dialog>
    </div>
  );
}
