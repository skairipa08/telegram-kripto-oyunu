import { useState } from 'react';
import { MintGame } from './mint-game';
import { CatizenMergeGame } from './catizen-merge-game';
import { DynastyCipherGame } from './dynasty-cipher-game';
import { NotcoinTapGame } from './notcoin-tap-game';
import { CryptoCrashGame } from './crypto-crash-game';
import { CryptoMinesGame } from './crypto-mines-game';
import { CryptoPredictionsGame } from './crypto-predictions-game';
import { DailyComboCard } from './daily-combo-card';
import { isMuted, toggleMute, initAudio, playTapSound } from '../game/arcade-audio';
import { triggerHaptic } from '../game/arcade-haptics';
import { formatNumber } from '../game/ui';
import './arcade.css';

export type ArcadeGame =
  | 'tap'
  | 'merge'
  | 'crash'
  | 'mines'
  | 'predictions'
  | 'combo'
  | 'cipher'
  | 'mint';

export interface ArcadeGameInfo {
  id: ArcadeGame;
  name: string;
  tabLabel: string;
  category: 'risk' | 'casual' | 'daily';
  categoryLabel: string;
  badge: string;
  badgeColor: string;
  icon: string;
  tagline: string;
}

export const ARCADE_GAMES: ArcadeGameInfo[] = [
  {
    id: 'tap',
    name: 'Dokun Kazan',
    tabLabel: 'Dokun',
    category: 'casual',
    categoryLabel: '⚡ Hızlı Kazan',
    badge: '⚡ HIZLI',
    badgeColor: '#fbbf24',
    icon: '🪙',
    tagline: 'Turbo enerjiyle altınları topla',
  },
  {
    id: 'merge',
    name: 'Catizen Birleştir',
    tabLabel: 'Birleştir',
    category: 'casual',
    categoryLabel: '⚡ Hızlı Kazan',
    badge: '🐾 PASİF',
    badgeColor: '#34d399',
    icon: '🧩',
    tagline: 'Çipleri birleştir, saniyelik DPS üret',
  },
  {
    id: 'crash',
    name: 'Kripto Çöküş',
    tabLabel: 'Çöküş',
    category: 'risk',
    categoryLabel: '🔥 Risk & Kazanç',
    badge: '🔥 10.000X',
    badgeColor: '#f87171',
    icon: '🚀',
    tagline: 'Boğa rallisinde roket patlamadan kârı al',
  },
  {
    id: 'mines',
    name: 'Mayın Tarlası',
    tabLabel: 'Mayın',
    category: 'risk',
    categoryLabel: '🔥 Risk & Kazanç',
    badge: '💎 POPÜLER',
    badgeColor: '#38bdf8',
    icon: '💣',
    tagline: 'Elmasları topla, mayınlardan kaç',
  },
  {
    id: 'predictions',
    name: 'Fiyat Tahmini',
    tabLabel: 'Tahmin',
    category: 'risk',
    categoryLabel: '🔥 Risk & Kazanç',
    badge: '📈 60s',
    badgeColor: '#a78bfa',
    icon: '🎯',
    tagline: 'BTC ve TON yönünü bil, oranı kap',
  },
  {
    id: 'combo',
    name: 'Günlük Kombo',
    tabLabel: 'Kombo',
    category: 'daily',
    categoryLabel: '🎁 Günlük Görev',
    badge: '🎁 5.000.000',
    badgeColor: '#fb923c',
    icon: '🔑',
    tagline: '3 gizli kartı bul, dev ödülü kap',
  },
  {
    id: 'cipher',
    name: 'Hanedan Deşifre',
    tabLabel: 'Deşifre',
    category: 'daily',
    categoryLabel: '🎁 Günlük Görev',
    badge: '🧠 1.000.000',
    badgeColor: '#67e8f9',
    icon: '💻',
    tagline: 'Siber mors kodunu ve şifreyi çöz',
  },
  {
    id: 'mint',
    name: 'Darphane Refleks',
    tabLabel: 'Darphane',
    category: 'casual',
    categoryLabel: '⚡ Hızlı Kazan',
    badge: '🎯 HEDEF',
    badgeColor: '#f472b6',
    icon: '⚡',
    tagline: 'Çarkı tam hedefte durdur, refleksini göster',
  },
];

const modules: Record<
  ArcadeGame,
  { name: string; detail: string; price: number }
> = {
  tap: {
    name: 'TapBot Asistanı',
    detail: 'Çevrimdışıyken otomatik dokunur ve nakit biriktirir.',
    price: 149,
  },
  merge: {
    name: 'Oto Birleştirici',
    detail: 'Otomatik paket açar ve en uygun çiftleri birleştirir.',
    price: 129,
  },
  crash: {
    name: 'Boğa Algoritması',
    detail: 'Piyasa çöküş riskini analiz eder ve sinyal verir.',
    price: 199,
  },
  mines: {
    name: 'Mayın Dedektörü',
    detail: 'İlk hamlede mayın basma riskini %50 düşürür.',
    price: 149,
  },
  predictions: {
    name: 'Kahin Oran Takviyesi',
    detail: 'Tüm tahmin kuponlarına +0.15x ekstra oran çarpanı ekler.',
    price: 179,
  },
  combo: {
    name: 'Siber Kart Tarayıcı',
    detail: 'Günün doğru kombo kartlarından birini anında gösterir.',
    price: 99,
  },
  cipher: {
    name: 'Şifre Botu',
    detail: 'Sıradaki doğru siber mührü ekranda gösterir.',
    price: 99,
  },
  mint: {
    name: 'Hassasiyet Modülü',
    detail: '3 tur boyunca hedef vuruş alanını genişletir.',
    price: 79,
  },
};

export function EmpireArcade({
  preview = false,
  onPreviewReward,
  initialGame = 'tap',
  playerCash = 10000,
  onCashUpdated,
  referralLink,
  clanTag,
  clanName,
}: {
  preview?: boolean;
  onPreviewReward?: (amount: number) => void;
  initialGame?: ArcadeGame;
  playerCash?: number;
  onCashUpdated?: (newCash: number) => void;
  referralLink?: string;
  clanTag?: string;
  clanName?: string;
}) {
  const [game, setGame] = useState<ArcadeGame>(initialGame);
  const [muted, setMutedState] = useState<boolean>(() => isMuted());
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'risk' | 'casual' | 'daily'>('all');
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [assists, setAssists] = useState<Record<ArcadeGame, boolean>>({
    tap: false,
    merge: false,
    crash: false,
    mines: false,
    predictions: false,
    combo: false,
    cipher: false,
    mint: false,
  });

  const module = modules[game];
  const activeMeta = ARCADE_GAMES.find((g) => g.id === game) ?? ARCADE_GAMES[0]!;

  function handleTabChange(nextGame: ArcadeGame) {
    initAudio();
    playTapSound();
    triggerHaptic('impact_light');
    setGame(nextGame);
  }

  function handleToggleAudio() {
    const next = toggleMute();
    setMutedState(next);
  }

  const catalogGames =
    categoryFilter === 'all'
      ? ARCADE_GAMES
      : ARCADE_GAMES.filter((g) => g.category === categoryFilter);

  return (
    <section
      className="empire-arcade empire-arcade-v2"
      aria-labelledby="arcade-title"
    >
      {/* Header bar with audio mute toggle and player balance */}
      <div className="arcade-header-bar">
        <div className="arcade-header-title">
          <p className="eyebrow" style={{ margin: 0 }}>
            EMPIRE OYUN SALONU
          </p>
          <h2 id="arcade-title">Arcade Eğlence Merkezi</h2>
          <p>Dokun, birleştir, hackle, yükselt ve nakit kazan.</p>
        </div>
        <div className="arcade-header-actions">
          <div
            style={{
              padding: '6px 10px',
              borderRadius: '10px',
              background: 'rgba(225, 180, 126, 0.12)',
              border: '1px solid rgba(225, 180, 126, 0.25)',
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--accent, #e1b47e)',
              whiteSpace: 'nowrap',
            }}
          >
            💰 {formatNumber(playerCash)}
          </div>
          <button
            className="arcade-mute-btn"
            onClick={handleToggleAudio}
            aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
            title={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Category Pills & Hub View Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <div className="arcade-category-pills">
          <button
            type="button"
            className={`arcade-category-pill ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            🎮 Tümü (8)
          </button>
          <button
            type="button"
            className={`arcade-category-pill ${categoryFilter === 'risk' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('risk')}
          >
            🔥 Risk & Çarpan (3)
          </button>
          <button
            type="button"
            className={`arcade-category-pill ${categoryFilter === 'casual' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('casual')}
          >
            ⚡ Hızlı Kazan (3)
          </button>
          <button
            type="button"
            className={`arcade-category-pill ${categoryFilter === 'daily' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('daily')}
          >
            🎁 Günlük (2)
          </button>
        </div>

        <button
          type="button"
          className="arcade-stage-switch-btn"
          onClick={() => setIsLobbyOpen((prev) => !prev)}
        >
          {isLobbyOpen ? '✕ Kartları Kapat' : '📋 Oyun Kartları'}
        </button>
      </div>

      {/* Expandable Rich Game Cards Hub */}
      {isLobbyOpen && (
        <div className="arcade-hub-grid">
          {catalogGames.map((g) => (
            <div
              key={g.id}
              className={`arcade-game-card ${game === g.id ? 'active' : ''}`}
              onClick={() => {
                handleTabChange(g.id);
                setIsLobbyOpen(false);
              }}
            >
              <div className="arcade-game-card-top">
                <span className="arcade-game-card-icon">{g.icon}</span>
                <span
                  className="arcade-game-card-badge"
                  style={{
                    color: g.badgeColor,
                    background: `${g.badgeColor}22`,
                    border: `1px solid ${g.badgeColor}44`,
                  }}
                >
                  {g.badge}
                </span>
              </div>
              <div>
                <h4 className="arcade-game-card-title">{g.name}</h4>
                <p className="arcade-game-card-tagline">{g.tagline}</p>
              </div>
              <button type="button" className="arcade-game-card-play-btn">
                {game === g.id ? '✓ Şu An Açık' : '▶ Hemen Oyna'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Arcade Games Tabs Navigation - 2 rows of 4 buttons (8 total) */}
      <div
        className="arcade-nav-tabs"
        role="tablist"
        aria-label="Arcade Oyunları"
      >
        {ARCADE_GAMES.map((g) => (
          <button
            key={g.id}
            role="tab"
            className={`arcade-nav-tab ${game === g.id ? 'active' : ''}`}
            aria-selected={game === g.id}
            onClick={() => handleTabChange(g.id)}
          >
            <span className="tab-icon">{g.icon}</span>
            <span>{g.tabLabel}</span>
          </button>
        ))}
      </div>

      {/* Active Game Stage Bar */}
      <div className="arcade-stage-bar">
        <div className="arcade-stage-info">
          <span className="arcade-stage-icon">{activeMeta.icon}</span>
          <div className="arcade-stage-title-wrap">
            <span className="arcade-stage-title">{activeMeta.name}</span>
            <span className="arcade-stage-badge">
              {activeMeta.badge} · {activeMeta.tagline}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="arcade-stage-switch-btn"
          onClick={() => setIsLobbyOpen((prev) => !prev)}
        >
          {isLobbyOpen ? '✕ Kapat' : '🎮 Oyun Değiştir'}
        </button>
      </div>

      {/* Active Game Tabpanel */}
      <div role="tabpanel" className="arcade-tabpanel">
        {game === 'tap' && (
          <NotcoinTapGame
            preview={preview}
            playerCash={playerCash}
            {...(onPreviewReward ? { onReward: onPreviewReward } : {})}
          />
        )}
        {game === 'merge' && (
          <CatizenMergeGame
            preview={preview}
            autoMerge={assists.merge}
            {...(onPreviewReward ? { onReward: onPreviewReward } : {})}
            {...(referralLink ? { referralLink } : {})}
          />
        )}
        {game === 'crash' && (
          <CryptoCrashGame
            preview={preview}
            playerCash={playerCash}
            {...(onCashUpdated ? { onCashUpdated } : {})}
            {...(onPreviewReward ? { onReward: onPreviewReward } : {})}
            {...(referralLink ? { referralLink } : {})}
          />
        )}
        {game === 'mines' && (
          <CryptoMinesGame
            playerCash={playerCash}
            onCashUpdated={onCashUpdated}
            preview={preview}
            {...(referralLink ? { referralLink } : {})}
          />
        )}
        {game === 'predictions' && (
          <CryptoPredictionsGame
            playerCash={playerCash}
            onCashUpdated={onCashUpdated}
          />
        )}
        {game === 'combo' && (
          <DailyComboCard
            userCash={playerCash}
            referralLink={referralLink ?? ''}
            clanTag={clanTag}
            clanName={clanName}
            {...(onCashUpdated ? { onRewardClaimed: onCashUpdated } : {})}
          />
        )}
        {game === 'cipher' && (
          <DynastyCipherGame
            preview={preview}
            assistant={assists.cipher}
            {...(onPreviewReward ? { onReward: onPreviewReward } : {})}
          />
        )}
        {game === 'mint' && (
          <MintGame
            preview={preview}
            precisionAssist={assists.mint}
            {...(onPreviewReward ? { onReward: onPreviewReward } : {})}
          />
        )}
      </div>

      {/* Assist Module Card */}
      <aside className="arcade-module-card">
        <div>
          <p className="eyebrow">YARDIMCI MODÜL</p>
          <strong>{module.name}</strong>
          <span>{module.detail} Rekabetçi skor ayrı işaretlenir.</span>
        </div>
        <div>
          <b>{module.price} ⭐</b>
          <button
            className="button secondary"
            aria-disabled={!preview}
            {...(preview
              ? {
                  onClick: () =>
                    setAssists((current) => ({
                      ...current,
                      [game]: !current[game],
                    })),
                }
              : {})}
          >
            {assists[game]
              ? 'Modülü kapat'
              : preview
                ? 'Modülü dene'
                : 'Satın alma yakında'}
          </button>
        </div>
      </aside>
    </section>
  );
}
