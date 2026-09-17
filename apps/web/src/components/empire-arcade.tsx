import { useState } from 'react';
import { MintGame } from './mint-game';
import { CatizenMergeGame } from './catizen-merge-game';
import { DynastyCipherGame } from './dynasty-cipher-game';
import { NotcoinTapGame } from './notcoin-tap-game';
import { CryptoCrashGame } from './crypto-crash-game';
import { CryptoMinesGame } from './crypto-mines-game';
import { CryptoPredictionsGame } from './crypto-predictions-game';
import { DailyComboCard } from './daily-combo-card';
import { isMuted, toggleMute, initAudio } from '../game/arcade-audio';
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

  function handleTabChange(nextGame: ArcadeGame) {
    initAudio();
    setGame(nextGame);
  }

  function handleToggleAudio() {
    const next = toggleMute();
    setMutedState(next);
  }

  return (
    <section
      className="empire-arcade empire-arcade-v2"
      aria-labelledby="arcade-title"
    >
      {/* Header bar with audio mute toggle */}
      <div className="arcade-header-bar">
        <div className="arcade-header-title">
          <p className="eyebrow" style={{ margin: 0 }}>
            EMPIRE OYUN SALONU
          </p>
          <h2 id="arcade-title">Arcade Eğlence Merkezi</h2>
          <p>Dokun, birleştir, hackle, yükselt ve nakit kazan.</p>
        </div>
        <div className="arcade-header-actions">
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

      {/* Arcade Games Tabs Navigation */}
      <div
        className="arcade-nav-tabs"
        role="tablist"
        aria-label="Arcade Oyunları"
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '6px',
          paddingBottom: '4px',
        }}
      >
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'tap' ? 'active' : ''}`}
          aria-selected={game === 'tap'}
          onClick={() => handleTabChange('tap')}
        >
          <span className="tab-icon">🪙</span>
          <span>Dokun</span>
        </button>
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'merge' ? 'active' : ''}`}
          aria-selected={game === 'merge'}
          onClick={() => handleTabChange('merge')}
        >
          <span className="tab-icon">🧩</span>
          <span>Birleştir</span>
        </button>
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'crash' ? 'active' : ''}`}
          aria-selected={game === 'crash'}
          onClick={() => handleTabChange('crash')}
        >
          <span className="tab-icon">🚀</span>
          <span>Çöküş</span>
        </button>
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'mines' ? 'active' : ''}`}
          aria-selected={game === 'mines'}
          onClick={() => handleTabChange('mines')}
        >
          <span className="tab-icon">💣</span>
          <span>Mayın</span>
        </button>
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'predictions' ? 'active' : ''}`}
          aria-selected={game === 'predictions'}
          onClick={() => handleTabChange('predictions')}
        >
          <span className="tab-icon">🎯</span>
          <span>Tahmin</span>
        </button>
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'combo' ? 'active' : ''}`}
          aria-selected={game === 'combo'}
          onClick={() => handleTabChange('combo')}
        >
          <span className="tab-icon">🔑</span>
          <span>Kombo</span>
        </button>
        <button
          role="tab"
          className={`arcade-nav-tab ${game === 'cipher' ? 'active' : ''}`}
          aria-selected={game === 'cipher'}
          onClick={() => handleTabChange('cipher')}
        >
          <span className="tab-icon">💻</span>
          <span>Deşifre</span>
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
