import type { PlayerState } from '@empire/shared';
import { BrandMark } from './brand-mark';
import { Icon } from './icons';
import type { IconName } from './icons';

const navigation: Array<{
  english: string;
  turkish: string;
  icon: IconName;
}> = [
  { english: 'Empire', turkish: 'İmparatorluk', icon: 'empire' },
  { english: 'Missions', turkish: 'Görevler', icon: 'missions' },
  { english: 'Friends', turkish: 'Arkadaşlar', icon: 'friends' },
  { english: 'Leaderboard', turkish: 'Sıralama', icon: 'leaderboard' },
  { english: 'Shop', turkish: 'Mağaza', icon: 'shop' },
];

type GameShellProps = {
  state: PlayerState;
  onLogout: () => void;
  isLoggingOut: boolean;
  logoutFailed: boolean;
};

export function GameShell({
  state,
  onLogout,
  isLoggingOut,
  logoutFailed,
}: GameShellProps) {
  return (
    <div className="game-viewport safe-page">
      <header className="game-header">
        <div className="brand">
          <BrandMark />
          <span>EMPIRE</span>
        </div>
        <span className="secure-pill">
          <span aria-hidden="true" /> Güvenli oturum
        </span>
      </header>

      <main className="game-main">
        <section className="player-intro" aria-labelledby="player-title">
          <p className="eyebrow">ŞEHRİNE HOŞ GELDİN</p>
          <h1 id="player-title">Merhaba, {state.user.firstName}</h1>
          <p>
            {state.user.username
              ? `@${state.user.username}`
              : 'Telegram oyuncusu'}
          </p>
        </section>

        <section className="construction-card" aria-labelledby="empire-status">
          <div className="construction-visual" aria-hidden="true">
            <svg viewBox="0 0 280 150">
              <path d="M22 126h236M53 126V79h46v47m15 0V46h58v80m15 0V70h41v56M132 46V23h22v23" />
              <path d="M67 94h17m-17 16h17m66-44h17m-17 20h17m-17 20h17m51-20h17m-17 18h17" />
            </svg>
          </div>
          <p className="card-label">İMPARATORLUK DURUMU</p>
          <h2 id="empire-status">Şehrin hazırlanıyor</h2>
          <p>
            İlk işletmeler, görevler ve sezon sistemi yakında burada olacak.
          </p>
          <span className="coming-badge">YAKINDA</span>
        </section>

        <section className="session-card" aria-labelledby="session-title">
          <div>
            <p className="card-label">HESAP</p>
            <h2 id="session-title">Telegram ile bağlı</h2>
            <p>Oturum bilgilerin sunucu tarafından güvenle doğrulandı.</p>
          </div>
          <button
            type="button"
            className="secondary-action"
            onClick={onLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Çıkılıyor…' : 'Çıkış yap'}
          </button>
        </section>
        {logoutFailed && (
          <p className="inline-error" role="alert">
            Çıkış tamamlanamadı. Tekrar deneyebilirsin.
          </p>
        )}
      </main>

      <nav className="game-nav" aria-label="Oyun bölümleri">
        {navigation.map((item) => (
          <button
            type="button"
            className="nav-item"
            key={item.english}
            aria-label={`${item.english} / ${item.turkish} — Yakında`}
            disabled
          >
            <Icon name={item.icon} />
            <span>{item.turkish}</span>
            <small>Yakında</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
