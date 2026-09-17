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

  const [tilt, setTilt] = useState<{
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    isRebound: boolean;
  }>({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    isRebound: false,
  });
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [offlineModal, setOfflineModal] = useState<{
    coins: number;
    hours: number;
  } | null>(null);

  const coinRef = useRef<HTMLDivElement | null>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      isCrit: boolean;
      life: number;
    }>
  >([]);
  const textParticlesRef = useRef<
    Array<{
      text: string;
      x: number;
      y: number;
      vy: number;
      alpha: number;
      scale: number;
    }>
  >([]);
  const animFrameRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef(false);
  const tiltTimerRef = useRef<number | null>(null);
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

  // Active in-game TapBot auto-tapper (taps every 1.5s when unlocked and energy available)
  useEffect(() => {
    if (!tapState.upgrades.tapBotUnlocked) return;
    const botInterval = window.setInterval(() => {
      const current = tapStateRef.current;
      if (current.currentEnergy >= 1) {
        const result = performTap(current);
        if (result) {
          tapStateRef.current = result.nextState;
          setTapState(result.nextState);
          if (onReward) onReward(result.coinsEarned);

          // Add floating number indicating bot tap
          const id = `bot-${Date.now()}-${Math.random()}`;
          setFloatingNumbers((prev) => [
            ...prev,
            {
              id,
              amount: result.coinsEarned,
              x: 110 + (Math.random() * 40 - 20),
              y: 70,
              isCrit: result.isCrit,
            },
          ]);
          window.setTimeout(() => {
            setFloatingNumbers((prev) => prev.filter((item) => item.id !== id));
          }, 900);
        }
      }
    }, 1500);

    return () => clearInterval(botInterval);
  }, [tapState.upgrades.tapBotUnlocked, onReward]);

  // Cleanup animation frame and timers on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
    };
  }, []);

  function startParticleLoop() {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    function renderLoop() {
      const canvas = particleCanvasRef.current;
      if (!canvas) {
        isLoopRunningRef.current = false;
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isLoopRunningRef.current = false;
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const textParticles = textParticlesRef.current;

      // Update & render spark particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.isCrit ? 0.22 : 0.15;
        p.vx *= 0.98;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.isCrit) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.8;
          ctx.lineCap = 'round';
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 10;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.isCrit ? 12 : 6;
        ctx.fill();
      }

      // Update & render text particles ("CRIT! +50")
      for (let i = textParticles.length - 1; i >= 0; i--) {
        const tp = textParticles[i]!;
        tp.y += tp.vy;
        tp.vy *= 0.96;
        tp.alpha -= 0.025;
        tp.scale = Math.max(1.0, tp.scale - 0.02);

        if (tp.alpha <= 0) {
          textParticles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, tp.alpha);
        ctx.font = '900 16px "SF Pro Display", sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffd700';
        ctx.fillText(tp.text, tp.x, tp.y);
        ctx.restore();
      }

      ctx.restore();

      if (particles.length > 0 || textParticles.length > 0) {
        animFrameRef.current = requestAnimationFrame(renderLoop);
      } else {
        isLoopRunningRef.current = false;
      }
    }

    animFrameRef.current = requestAnimationFrame(renderLoop);
  }

  function spawnTapSparks(
    x: number,
    y: number,
    isCrit: boolean,
    amount: number,
  ) {
    const particles = particlesRef.current;
    if (particles.length > 150) {
      particles.splice(0, 30);
    }

    if (isCrit) {
      const count = 28;
      const critColors = [
        '#ffd700',
        '#00e5ff',
        '#ff3366',
        '#ffffff',
        '#ffaa00',
      ];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const speed = 4.5 + Math.random() * 6.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          size: 2.8 + Math.random() * 2.5,
          color: critColors[Math.floor(Math.random() * critColors.length)]!,
          alpha: 1.0,
          decay: 0.022 + Math.random() * 0.018,
          isCrit: true,
          life: 1.0,
        });
      }

      textParticlesRef.current.push({
        text: `CRIT! +${amount}`,
        x,
        y: y - 10,
        vy: -2.4,
        alpha: 1.0,
        scale: 1.4,
      });
    } else {
      const count = 8;
      const normalColors = ['#ffd700', '#ffea80', '#e1b47e', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.0 + Math.random() * 4.0;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.0,
          size: 2.0 + Math.random() * 2.0,
          color: normalColors[Math.floor(Math.random() * normalColors.length)]!,
          alpha: 1.0,
          decay: 0.04 + Math.random() * 0.03,
          isCrit: false,
          life: 1.0,
        });
      }
    }

    startParticleLoop();
  }

  // Handle multi-touch tapping cleanly
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.cancelable) e.preventDefault();
    const rect = coinRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radiusX = rect.width / 2;
    const radiusY = rect.height / 2;

    let latestNx = 0;
    let latestNy = 0;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i]!;
      const current = tapStateRef.current;
      const result = performTap(current);
      if (!result) break; // Insufficient energy

      tapStateRef.current = result.nextState;
      if (onReward) onReward(result.coinsEarned);

      if (result.isCrit) {
        playCritSound();
        hapticCrit();
      } else {
        playTapSound();
        hapticTap();
      }

      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;

      latestNx = Math.max(-1, Math.min(1, (touch.clientX - centerX) / radiusX));
      latestNy = Math.max(-1, Math.min(1, (touch.clientY - centerY) / radiusY));

      spawnTapSparks(touchX, touchY, result.isCrit, result.coinsEarned);

      const newFloating: FloatingNumber = {
        id: `float-${Date.now()}-${Math.random()}`,
        x: touchX,
        y: touchY,
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

    setTapState(tapStateRef.current);

    const rotX = -latestNy * 22;
    const rotY = latestNx * 22;
    const scaleZ = 0.88;
    const scaleX = 0.94 + 0.04 * Math.abs(latestNy);
    const scaleY = 0.94 + 0.04 * Math.abs(latestNx);
    setTilt({ x: rotX, y: rotY, scaleX, scaleY, scaleZ, isRebound: false });

    if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
    tiltTimerRef.current = window.setTimeout(() => {
      setTilt({
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        isRebound: true,
      });
    }, 110);
  }

  // Handle Coin Tap / Click (Mouse & Pointer fallback)
  function handleCoinTap(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'touch') return; // Handled by onTouchStart

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
      const Nx = Math.max(-1, Math.min(1, deltaX));
      const Ny = Math.max(-1, Math.min(1, deltaY));

      const rotX = -Ny * 22;
      const rotY = Nx * 22;
      const scaleZ = 0.88;
      const scaleX = 0.94 + 0.04 * Math.abs(Ny);
      const scaleY = 0.94 + 0.04 * Math.abs(Nx);

      setTilt({
        x: rotX,
        y: rotY,
        scaleX,
        scaleY,
        scaleZ,
        isRebound: false,
      });

      if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current);
      tiltTimerRef.current = window.setTimeout(() => {
        setTilt({
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
          isRebound: true,
        });
      }, 110);

      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      spawnTapSparks(localX, localY, result.isCrit, result.coinsEarned);

      // Spawn floating number
      const newFloating: FloatingNumber = {
        id: `float-${Date.now()}-${Math.random()}`,
        x: localX,
        y: localY,
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
        <canvas ref={particleCanvasRef} className="tap-particle-canvas" />
        <div
          ref={coinRef}
          className="tap-coin-target"
          onTouchStart={handleTouchStart}
          onPointerDown={handleCoinTap}
          style={{
            transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${tilt.scaleX}, ${tilt.scaleY}, ${tilt.scaleZ})`,
            transition: tilt.isRebound
              ? 'transform 0.24s cubic-bezier(0.175, 0.885, 0.32, 1.35)'
              : 'transform 0.05s ease-out',
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
        <div
          className={`tap-energy-track ${energyPercent < 20 ? 'is-low' : ''}`}
        >
          <div
            className="tap-energy-fill"
            style={{ width: `${energyPercent}%` }}
          >
            <span className="tap-energy-photon" />
          </div>
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
