import React, { useEffect, useRef, useState } from 'react';
import {
  applyTapUpgrade,
  calculateTapBotOfflineEarnings,
  createInitialTapState,
  getCapacityUpgradeCost,
  getMaxEnergy,
  getMultitapUpgradeCost,
  getOfflineExtenderCost,
  getRechargeRate,
  getRechargeUpgradeCost,
  getTapPower,
  performTap,
  syncEnergyWithTime,
  TAPBOT_UNLOCK_COST,
  type TapState,
} from '../game/notcoin-tap-model';
import {
  playCritSound,
  playTapSound,
  playWinSound,
} from '../game/arcade-audio';
import { hapticCrit, hapticSuccess, hapticTap } from '../game/arcade-haptics';
import './arcade.css';

const TAP_STORAGE_KEY = 'empire_notcoin_tap_state_v1';

interface FloatingNumber {
  id: string;
  x: number;
  y: number;
  amount: number;
  isCrit: boolean;
}

export interface NotcoinTapGameProps {
  onReward?: (amount: number) => void;
  playerCash?: number;
  preview?: boolean;
}

export function NotcoinTapGame({
  onReward,
  playerCash = 1000,
}: NotcoinTapGameProps) {
  const [tapState, setTapState] = useState<TapState>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(TAP_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as TapState;
          return syncEnergyWithTime(parsed);
        }
      } catch {
        // Fallback
      }
    }
    return createInitialTapState();
  });

  const [tilt, setTilt] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [offlineModal, setOfflineModal] = useState<{
    coins: number;
    hours: number;
  } | null>(null);

  const coinRef = useRef<HTMLDivElement | null>(null);
  const tickerIntervalRef = useRef<number | null>(null);
  const tapStateRef = useRef<TapState>(tapState);

  useEffect(() => {
    tapStateRef.current = tapState;
  }, [tapState]);

  // Save to localStorage on state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(TAP_STORAGE_KEY, JSON.stringify(tapState));
      } catch {
        // Ignore storage errors
      }
    }
  }, [tapState]);

  // Check offline TapBot earnings on initial mount
  useEffect(() => {
    if (tapState.upgrades.tapBotUnlocked) {
      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - tapState.lastUpdatedTimestamp) / 1000),
      );
      if (elapsedSeconds > 60) {
        const offlineReport = calculateTapBotOfflineEarnings(
          true,
          tapState.upgrades.multitap,
          tapState.upgrades.offlineLimitHours,
          elapsedSeconds,
        );
        if (offlineReport.coinsEarned > 0) {
          setOfflineModal({
            coins: offlineReport.coinsEarned,
            hours: Number((offlineReport.cappedSeconds / 3600).toFixed(1)),
          });
        }
      }
    }
  }, []);

  // Energy regeneration interval (updates every 500ms)
  useEffect(() => {
    tickerIntervalRef.current = window.setInterval(() => {
      setTapState((prev) => {
        const synced = syncEnergyWithTime(prev);
        tapStateRef.current = synced;
        return synced;
      });
    }, 500);

    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, []);

  // Handle Coin Tap / Click
  function handleCoinTap(e: React.PointerEvent<HTMLDivElement>) {
    const current = tapStateRef.current;
    const result = performTap(current);
    if (!result) return; // Insufficient energy

    tapStateRef.current = result.nextState;
    setTapState(result.nextState);
    if (onReward) onReward(result.coinsEarned);

    // Audio & Haptics
    if (result.isCrit) {
      playCritSound();
      hapticCrit();
    } else {
      playTapSound();
      hapticTap();
    }

    // Calculate 3D tilt coordinates based on touch location
    if (coinRef.current) {
      const rect = coinRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      setTilt({
        x: -deltaY * 18,
        y: deltaX * 18,
        scale: 0.94,
      });

      setTimeout(() => {
        setTilt({ x: 0, y: 0, scale: 1 });
      }, 100);

      // Spawn floating number
      const newFloating: FloatingNumber = {
        id: `float-${Date.now()}-${Math.random()}`,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        amount: result.coinsEarned,
        isCrit: result.isCrit,
      };

      setFloatingNumbers((prev) => [...prev, newFloating]);

      setTimeout(() => {
        setFloatingNumbers((prev) =>
          prev.filter((f) => f.id !== newFloating.id),
        );
      }, 800);
    }
  }

  function handleBuyUpgrade(
    type:
      | 'multitap'
      | 'energyCapacity'
      | 'rechargeSpeed'
      | 'tapBot'
      | 'offlineLimit',
  ) {
    playTapSound();
    hapticSuccess();
    setTapState((prev) => {
      const next = applyTapUpgrade(prev, type);
      tapStateRef.current = next;
      return next;
    });
  }

  function claimOfflineEarnings() {
    if (offlineModal) {
      playWinSound();
      hapticSuccess();
      if (onReward) onReward(offlineModal.coins);
      setOfflineModal(null);
    }
  }

  const maxEnergy = getMaxEnergy(tapState.upgrades.energyCapacity);
  const rechargeRate = getRechargeRate(tapState.upgrades.rechargeSpeed);
  const tapPower = getTapPower(tapState.upgrades.multitap);
  const energyPercent = Math.min(
    100,
    Math.round((tapState.currentEnergy / maxEnergy) * 100),
  );

  const multitapCost = getMultitapUpgradeCost(tapState.upgrades.multitap);
  const capacityCost = getCapacityUpgradeCost(tapState.upgrades.energyCapacity);
  const rechargeCost = getRechargeUpgradeCost(tapState.upgrades.rechargeSpeed);
  const offlineCost = getOfflineExtenderCost(
    tapState.upgrades.offlineLimitHours,
  );

  return (
    <div className="notcoin-tap-game" aria-label="Notcoin Dokun Kazan">
      {/* Offline Earnings Dialog */}
      {offlineModal && (
        <div
          role="dialog"
          aria-labelledby="offline-title"
          style={{
            position: 'absolute',
            inset: 12,
            background: 'rgba(16, 24, 38, 0.96)',
            borderRadius: 16,
            zIndex: 30,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            textAlign: 'center',
            border: '1px solid var(--accent)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '2.5rem' }}>🤖</span>
          <h3 id="offline-title" style={{ margin: 0, color: 'var(--text)' }}>
            TapBot Kazanç Raporu
          </h3>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.85rem' }}>
            Sen yokken TapBot {offlineModal.hours} saat çalıştı ve kasana altın
            ekledi!
          </p>
          <strong style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>
            +{offlineModal.coins} Nakit
          </strong>
          <button className="button primary" onClick={claimOfflineEarnings}>
            Kazancı Al ve Başla
          </button>
        </div>
      )}

      {/* Top Scoreboard */}
      <div className="tap-scoreboard">
        <div className="tap-coins-display">
          <span className="amount">{tapState.totalCoinsEarned}</span>
          <span className="unit">Kazanılan Nakit</span>
        </div>
        <button
          className="button secondary"
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          onClick={() => setShowUpgrades(!showUpgrades)}
          aria-expanded={showUpgrades}
        >
          ⚡ Yükseltmeler
        </button>
      </div>

      {/* Central 3D Coin Target */}
      <div className="tap-coin-arena">
        <div
          ref={coinRef}
          className="tap-coin-target"
          onPointerDown={handleCoinTap}
          style={{
            transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${tilt.scale})`,
          }}
          role="button"
          tabIndex={0}
          aria-label={`Altın Coin'e Dokun · Dokunuş Başı +${tapPower} Nakit`}
        >
          <div className="tap-coin-inner">
            <span className="tap-coin-symbol">E</span>
            <span className="tap-coin-sub">PROJECT EMPIRE</span>
          </div>

          {/* Floating Number Particles */}
          <div className="floating-number-layer">
            {floatingNumbers.map((item) => (
              <div
                key={item.id}
                className={`floating-number ${item.isCrit ? 'crit' : ''}`}
                style={{ left: item.x, top: item.y }}
              >
                +{item.amount}
                {item.isCrit ? ' CRIT!' : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Energy Gauge */}
      <div className="tap-energy-container">
        <div className="tap-energy-header">
          <span>
            ⚡ {tapState.currentEnergy} / {maxEnergy}
          </span>
          <span>+{rechargeRate}/sn Dolum</span>
        </div>
        <div className="tap-energy-track">
          <div
            className="tap-energy-fill"
            style={{ width: `${energyPercent}%` }}
          />
        </div>
      </div>

      {/* Upgrade Drawer */}
      {showUpgrades && (
        <div className="tap-upgrade-drawer" aria-label="Geliştirme Menüsü">
          {/* Multitap */}
          <div className="tap-upgrade-item">
            <div className="tap-upgrade-info">
              <strong>Çoklu Dokunuş (Lv {tapState.upgrades.multitap})</strong>
              <span>Dokunuş başına +1 nakit</span>
            </div>
            <div className="tap-upgrade-actions">
              {multitapCost ? (
                <button
                  className="button secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  onClick={() => handleBuyUpgrade('multitap')}
                  disabled={playerCash < multitapCost.cash}
                >
                  {multitapCost.cash} Nakit / {multitapCost.stars} ⭐
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                  Maks
                </span>
              )}
            </div>
          </div>

          {/* Energy Capacity */}
          <div className="tap-upgrade-item">
            <div className="tap-upgrade-info">
              <strong>
                Enerji Sınırı (Lv {tapState.upgrades.energyCapacity})
              </strong>
              <span>+500 Maksimum enerji</span>
            </div>
            <div className="tap-upgrade-actions">
              {capacityCost ? (
                <button
                  className="button secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  onClick={() => handleBuyUpgrade('energyCapacity')}
                  disabled={playerCash < capacityCost.cash}
                >
                  {capacityCost.cash} Nakit / {capacityCost.stars} ⭐
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                  Maks
                </span>
              )}
            </div>
          </div>

          {/* Recharge Speed */}
          <div className="tap-upgrade-item">
            <div className="tap-upgrade-info">
              <strong>Dolum Hızı (Lv {tapState.upgrades.rechargeSpeed})</strong>
              <span>+1 Enerji/sn hızlanma</span>
            </div>
            <div className="tap-upgrade-actions">
              {rechargeCost ? (
                <button
                  className="button secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  onClick={() => handleBuyUpgrade('rechargeSpeed')}
                  disabled={playerCash < rechargeCost.cash}
                >
                  {rechargeCost.cash} Nakit / {rechargeCost.stars} ⭐
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                  Maks
                </span>
              )}
            </div>
          </div>

          {/* TapBot Auto-Tapper */}
          <div className="tap-upgrade-item">
            <div className="tap-upgrade-info">
              <strong>TapBot Asistanı</strong>
              <span>Çevrimdışıyken otomatik tıklar</span>
            </div>
            <div className="tap-upgrade-actions">
              {tapState.upgrades.tapBotUnlocked ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                  Aktif ✓
                </span>
              ) : (
                <button
                  className="button secondary"
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  onClick={() => handleBuyUpgrade('tapBot')}
                >
                  {TAPBOT_UNLOCK_COST.cash} / {TAPBOT_UNLOCK_COST.stars} ⭐
                </button>
              )}
            </div>
          </div>

          {/* Offline Limit Extender */}
          {tapState.upgrades.tapBotUnlocked && (
            <div className="tap-upgrade-item">
              <div className="tap-upgrade-info">
                <strong>
                  Kasa Süresi ({tapState.upgrades.offlineLimitHours}s)
                </strong>
                <span>Çevrimdışı toplama süresi sınırı</span>
              </div>
              <div className="tap-upgrade-actions">
                {offlineCost ? (
                  <button
                    className="button secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => handleBuyUpgrade('offlineLimit')}
                  >
                    {offlineCost.stars} ⭐
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--green)' }}>
                    24s Maks
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
