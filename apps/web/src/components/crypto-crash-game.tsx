import React, { useEffect, useRef, useState } from 'react';
import {
  calculateCrashPayout,
  calculateCrashProfit,
  calculateMultiplierAtTime,
  formatMultiplier,
  generateCrashPoint,
  generateNextCandle,
  getMultiplierTier,
  MAX_STAKE,
  MIN_STAKE,
  type Candlestick,
} from '../game/crypto-crash-model';

export const QUICK_CHIPS = [10, 50, 100, 250, 500] as const;
import {
  playCrashSound,
  playTapSound,
  playWinSound,
} from '../game/arcade-audio';
import { hapticCrash, hapticSuccess, hapticTap } from '../game/arcade-haptics';
import { formatNumber } from '../game/ui';
import './arcade.css';

export interface CryptoCrashGameProps {
  playerCash?: number;
  onReward?: (amount: number) => void;
  onCashUpdated?: (newCash: number) => void;
  preview?: boolean;
  referralLink?: string;
}

type GamePhase = 'idle' | 'countdown' | 'running' | 'cashed_out' | 'crashed';

export function CryptoCrashGame({
  playerCash = 1000,
  onReward,
  onCashUpdated,
  referralLink,
}: CryptoCrashGameProps) {
  const initialStake =
    playerCash >= MIN_STAKE ? Math.min(100, playerCash) : MIN_STAKE;
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [stake, setStake] = useState<number>(initialStake);
  const [rawStakeInput, setRawStakeInput] = useState<string>(
    String(initialStake),
  );
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [crashPoint, setCrashPoint] = useState<number>(2.0);
  const [countdown, setCountdown] = useState<number>(3);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(
    null,
  );
  const [history, setHistory] = useState<number[]>([
    1.45, 3.2, 1.15, 8.4, 2.1, 14.8,
  ]);

  const [screenShakeClass, setScreenShakeClass] = useState<string>('');
  const [cashoutProfitToast, setCashoutProfitToast] = useState<number | null>(
    null,
  );
  const [heartbeatPulse, setHeartbeatPulse] = useState<number>(1.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const candlesRef = useRef<Candlestick[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastCandleTimeRef = useRef<number>(0);
  const countTimerRef = useRef<number | null>(null);
  const hasCashedOutRef = useRef(false);
  const shakeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const thrusterParticlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    }>
  >([]);
  const redMistParticlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      alpha: number;
      decay: number;
    }>
  >([]);
  const confettiParticlesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      shape: 'ribbon' | 'spark';
      alpha: number;
      decay: number;
      rotation: number;
      rotSpeed: number;
    }>
  >([]);

  // Draw Candlesticks & Trailing Curve on Canvas
  function drawChart(currentMult: number, isCrashed: boolean) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background grid lines
    ctx.strokeStyle = 'rgba(150, 160, 180, 0.08)';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((ratio) => {
      const y = height * ratio;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });

    const candles = candlesRef.current;
    if (candles.length === 0) {
      ctx.restore();
      return;
    }

    // Determine scale: max multiplier so far with headroom
    const maxVal = Math.max(2.5, currentMult * 1.25);
    const minVal = 0.9;
    const valRange = maxVal - minVal;

    const getY = (val: number) =>
      height - ((val - minVal) / valRange) * (height - 24) - 12;

    const candleWidth = Math.max(
      6,
      Math.min(18, (width - 40) / Math.max(10, candles.length + 2)),
    );
    const spacing = candleWidth * 1.4;
    const startX = 20;

    // Draw Candlesticks
    candles.forEach((c, idx) => {
      const x = startX + idx * spacing;
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const highY = getY(c.high);
      const lowY = getY(c.low);

      const isBull = c.isBullish;
      const strokeColor = isBull ? '#7ed2ad' : '#ff9e9e';
      const fillColor = isBull ? '#7ed2ad' : '#ff9e9e';

      // Wick line
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Body box
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(3, Math.abs(closeY - openY));
      ctx.fillStyle = fillColor;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });

    // Trailing Curve Line, Rocket & Thruster Particles
    if (candles.length > 1) {
      const lastIdx = candles.length - 1;
      const lastX = startX + lastIdx * spacing;
      const lastY = getY(candles[lastIdx]!.close);
      const prevX = startX + Math.max(0, lastIdx - 1) * spacing;
      const prevY = getY(candles[Math.max(0, lastIdx - 1)]!.close);
      const angle = Math.atan2(lastY - prevY, lastX - prevX);

      // Pass 1: Glowing halo curve pass
      ctx.beginPath();
      ctx.strokeStyle = isCrashed
        ? 'rgba(255, 100, 100, 0.35)'
        : currentMult >= 10.0
          ? 'rgba(255, 215, 0, 0.35)'
          : 'rgba(126, 210, 173, 0.3)';
      ctx.lineWidth = 7;
      ctx.shadowColor = isCrashed
        ? '#ff4444'
        : currentMult >= 10.0
          ? '#ffd700'
          : '#7ed2ad';
      ctx.shadowBlur = 14;
      candles.forEach((c, idx) => {
        const x = startX + idx * spacing;
        const y = getY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Pass 2: Sharp core neon curve
      ctx.beginPath();
      ctx.strokeStyle = isCrashed
        ? '#ff9e9e'
        : currentMult >= 10.0
          ? '#ffd700'
          : '#7ed2ad';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      candles.forEach((c, idx) => {
        const x = startX + idx * spacing;
        const y = getY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Plasma Thruster particles trailing rocket nozzle
      if (!isCrashed) {
        const nozzleX = lastX - Math.cos(angle) * 12;
        const nozzleY = lastY - Math.sin(angle) * 12;
        const thrusterColors = ['#ffffff', '#00e5ff', '#ffd700', '#ff4400'];
        for (let p = 0; p < 2; p++) {
          const spread = (Math.random() - 0.5) * 0.6;
          const pAngle = angle + Math.PI + spread;
          const pSpeed = 2.5 + Math.random() * 4.5;
          thrusterParticlesRef.current.push({
            x: nozzleX,
            y: nozzleY,
            vx: Math.cos(pAngle) * pSpeed,
            vy: Math.sin(pAngle) * pSpeed,
            size: 2.0 + Math.random() * 2.5,
            color:
              thrusterColors[
                Math.floor(Math.random() * thrusterColors.length)
              ]!,
            alpha: 1.0,
            decay: 0.045 + Math.random() * 0.03,
          });
        }
      }

      // Render & update thruster particles
      const tp = thrusterParticlesRef.current;
      for (let i = tp.length - 1; i >= 0; i--) {
        const p = tp[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          tp.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Render Cyber-Rocket at curve head
      if (!isCrashed) {
        ctx.save();
        ctx.translate(lastX, lastY);
        ctx.rotate(angle);

        // Rocket hull (fuselage)
        ctx.fillStyle = '#f4f0e8';
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-7, -5);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-7, 5);
        ctx.closePath();
        ctx.fill();

        // Rocket wings & gold plating
        ctx.fillStyle = '#e1b47e';
        ctx.beginPath();
        ctx.moveTo(-2, -3.5);
        ctx.lineTo(-8, -8);
        ctx.lineTo(-5, -1.5);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-2, 3.5);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-5, 1.5);
        ctx.closePath();
        ctx.fill();

        // Cockpit visor (cyan glow)
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(1.5, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // Engine nozzle glow
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ff5500';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(-6, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else {
        // Exploded crash coordinate
        ctx.beginPath();
        ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 18;
        ctx.fill();

        // Dramatic Red Mist
        const mist = ctx.createRadialGradient(
          lastX,
          lastY,
          0,
          lastX,
          lastY,
          140,
        );
        mist.addColorStop(0, 'rgba(255, 30, 30, 0.45)');
        mist.addColorStop(0.5, 'rgba(255, 0, 0, 0.15)');
        mist.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = mist;
        ctx.fillRect(0, 0, width, height);

        // Drifting red embers
        const embers = redMistParticlesRef.current;
        for (let i = embers.length - 1; i >= 0; i--) {
          const em = embers[i]!;
          em.x += em.vx;
          em.y += em.vy;
          em.alpha -= em.decay;
          if (em.alpha <= 0) {
            embers.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, em.alpha);
          ctx.fillStyle = '#ff5555';
          ctx.shadowColor = '#ff2222';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(em.x, em.y, em.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Celebratory victory confetti shower
      const confetti = confettiParticlesRef.current;
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i]!;
        c.x += c.vx;
        c.y += c.vy;
        c.rotation += c.rotSpeed;
        c.alpha -= c.decay;
        if (c.alpha <= 0 || c.y > height + 20) {
          confetti.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, c.alpha);
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillStyle = c.color;
        if (c.shape === 'ribbon') {
          ctx.fillRect(-c.size, -c.size * 0.4, c.size * 2, c.size * 0.8);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, c.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Tension Heartbeat Vignette Pulse
      if (!isCrashed && currentMult > 2.0) {
        const bpm = Math.min(
          230,
          Math.max(
            60,
            Math.round(60 + 25 * Math.pow(Math.max(0, currentMult - 1), 0.75)),
          ),
        );
        const beatPeriod = 60000 / bpm;
        const beatFrac = (Date.now() % beatPeriod) / beatPeriod;
        const pulse =
          beatFrac < 0.22 ? Math.sin((beatFrac / 0.22) * Math.PI) : 0;
        if (pulse > 0) {
          ctx.save();
          ctx.strokeStyle =
            currentMult >= 10.0
              ? 'rgba(255, 60, 60, 0.45)'
              : 'rgba(225, 180, 126, 0.35)';
          ctx.lineWidth = 4 * pulse;
          ctx.strokeRect(0, 0, width, height);
          ctx.restore();
        }
      }
    }

    ctx.restore();
  }

  // Animation Loop
  function startRunningGame(targetCrash: number) {
    setPhase('running');
    startTimeRef.current = Date.now();
    lastCandleTimeRef.current = 0;
    candlesRef.current = [
      {
        index: 0,
        open: 1.0,
        high: 1.02,
        low: 0.99,
        close: 1.0,
        isBullish: true,
      },
    ];

    function loop() {
      const elapsedMs = Date.now() - startTimeRef.current;
      const currentMult = calculateMultiplierAtTime(elapsedMs);

      // Heartbeat pulse calculation for HUD
      const bpm = Math.min(
        230,
        Math.max(
          60,
          Math.round(60 + 25 * Math.pow(Math.max(0, currentMult - 1), 0.75)),
        ),
      );
      const beatPeriod = 60000 / bpm;
      const beatFrac = (Date.now() % beatPeriod) / beatPeriod;
      const pulse =
        beatFrac < 0.22 ? Math.sin((beatFrac / 0.22) * Math.PI) * 0.12 : 0;
      setHeartbeatPulse(1 + pulse);

      // Check if we need to generate a new candlestick every 450ms
      if (elapsedMs - lastCandleTimeRef.current >= 450) {
        lastCandleTimeRef.current = elapsedMs;
        const prevClose =
          candlesRef.current[candlesRef.current.length - 1]?.close ?? 1.0;
        const nextCandle = generateNextCandle(
          prevClose,
          currentMult,
          candlesRef.current.length,
        );
        candlesRef.current.push(nextCandle);
      }

      if (currentMult >= targetCrash) {
        // Crash!
        hasCashedOutRef.current = true;
        setMultiplier(targetCrash);
        setScreenShakeClass('is-crash-shake');
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = window.setTimeout(
          () => setScreenShakeClass(''),
          550,
        );

        // Spawn red embers
        const canvas = canvasRef.current;
        const w = canvas?.clientWidth || 320;
        const h = canvas?.clientHeight || 200;
        const embers = [];
        for (let i = 0; i < 35; i++) {
          embers.push({
            x: w * 0.7 + (Math.random() - 0.5) * 80,
            y: h * 0.4 + (Math.random() - 0.5) * 60,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 1.0 + Math.random() * 2.5,
            size: 2.0 + Math.random() * 3.0,
            alpha: 1.0,
            decay: 0.015 + Math.random() * 0.015,
          });
        }
        redMistParticlesRef.current = embers;

        drawChart(targetCrash, true);
        playCrashSound();
        hapticCrash();
        setPhase('crashed');
        setHistory((prev) => [targetCrash, ...prev.slice(0, 5)]);
        return;
      }

      setMultiplier(currentMult);
      drawChart(currentMult, false);
      animFrameRef.current = requestAnimationFrame(loop);
    }

    animFrameRef.current = requestAnimationFrame(loop);
  }

  // Cleanup anim frame and countdown timer on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (countTimerRef.current) clearInterval(countTimerRef.current);
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Initial render of empty/sample chart
  useEffect(() => {
    drawChart(1.0, false);
  }, []);

  const numericStake = parseInt(rawStakeInput, 10);
  const isFormatValid =
    !isNaN(numericStake) &&
    /^\d+$/.test(rawStakeInput.trim()) &&
    String(numericStake) === rawStakeInput.trim();
  const isBelowMin = isFormatValid && numericStake < MIN_STAKE;
  const isAboveBalance = isFormatValid && numericStake > playerCash;
  const isStakeValid = isFormatValid && !isBelowMin && !isAboveBalance;

  let validationMessage: string | null = null;
  if (!rawStakeInput.trim()) {
    validationMessage = `Lütfen bir yatırım tutarı girin (Min ${MIN_STAKE} Nakit).`;
  } else if (!isFormatValid) {
    validationMessage = 'Lütfen geçerli bir pozitif tam sayı girin.';
  } else if (isBelowMin) {
    validationMessage = `Minimum yatırım ${MIN_STAKE} Nakit olmalıdır.`;
  } else if (isAboveBalance) {
    validationMessage = `Yetersiz bakiye! Maksimum: ${playerCash} Nakit`;
  }

  function handleStakeInputChange(val: string) {
    const digitsOnly = val.replace(/\D/g, '');
    const normalized = digitsOnly.replace(/^0+(?=\d)/, '');
    setRawStakeInput(normalized);
    const parsed = parseInt(normalized, 10);
    if (!isNaN(parsed)) {
      setStake(parsed);
    }
  }

  function handleStakeBlur() {
    if (
      !rawStakeInput.trim() ||
      isNaN(numericStake) ||
      numericStake < MIN_STAKE
    ) {
      setStake(MIN_STAKE);
      setRawStakeInput(String(MIN_STAKE));
    } else if (playerCash > 0 && numericStake > playerCash) {
      const clamped = Math.max(MIN_STAKE, playerCash);
      setStake(clamped);
      setRawStakeInput(String(clamped));
    }
  }

  function handleSelectChip(chip: number) {
    setStake(chip);
    setRawStakeInput(String(chip));
    playTapSound();
    hapticTap();
  }

  function handleMaxStake() {
    const maxVal = Math.max(MIN_STAKE, playerCash);
    setStake(maxVal);
    setRawStakeInput(String(maxVal));
    playTapSound();
    hapticTap();
  }

  function handleStartRound() {
    if (phase !== 'idle' && phase !== 'crashed' && phase !== 'cashed_out')
      return;
    if (!isStakeValid || stake <= 0) return;

    playTapSound();
    hapticTap();

    hasCashedOutRef.current = false;
    if (countTimerRef.current) {
      clearInterval(countTimerRef.current);
      countTimerRef.current = null;
    }

    const targetCrash = generateCrashPoint();
    setCrashPoint(targetCrash);
    setMultiplier(1.0);
    setCashOutMultiplier(null);
    setPhase('countdown');
    setCountdown(3);

    // Deduct stake at the start of round
    if (onCashUpdated) {
      onCashUpdated(Math.max(0, playerCash - stake));
    } else if (onReward) {
      onReward(-stake);
    }

    countTimerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countTimerRef.current) {
            clearInterval(countTimerRef.current);
            countTimerRef.current = null;
          }
          startRunningGame(targetCrash);
          return 0;
        }
        return prev - 1;
      });
    }, 800);
  }

  function handleCashOut() {
    if (phase !== 'running' || hasCashedOutRef.current) return;
    hasCashedOutRef.current = true;

    const securedMult = multiplier;
    setCashOutMultiplier(securedMult);
    setPhase('cashed_out');

    setScreenShakeClass('is-cashout-flash is-cashout-bounce');
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(
      () => setScreenShakeClass(''),
      550,
    );

    const payout = calculateCrashPayout(stake, securedMult);
    const profit = calculateCrashProfit(stake, securedMult);
    setCashoutProfitToast(profit);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(
      () => setCashoutProfitToast(null),
      2500,
    );

    // Spawn celebratory victory confetti
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth || 320;
    const confetti: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      shape: 'ribbon' | 'spark';
      alpha: number;
      decay: number;
      rotation: number;
      rotSpeed: number;
    }> = [];
    const colors = ['#ffd700', '#7ed2ad', '#00e5ff', '#ffffff', '#ff9900'];
    for (let i = 0; i < 65; i++) {
      confetti.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 40,
        vx: (Math.random() - 0.5) * 3,
        vy: 2.5 + Math.random() * 4.5,
        size: 3.5 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        shape: Math.random() > 0.4 ? 'ribbon' : 'spark',
        alpha: 1.0,
        decay: 0.012 + Math.random() * 0.012,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
      });
    }
    confettiParticlesRef.current = confetti;

    playWinSound();
    hapticSuccess();
    if (onCashUpdated) {
      onCashUpdated(playerCash + payout);
    } else if (onReward) {
      onReward(payout);
    }
  }

  const tier = getMultiplierTier(multiplier);
  const potentialPayout = calculateCrashPayout(stake, multiplier);
  const potentialProfit = calculateCrashProfit(stake, multiplier);

  return (
    <div
      className={`crypto-crash-game ${screenShakeClass}`}
      aria-label="Kripto Mum Çöküş Oyunu"
    >
      {/* Round History Pill Strip */}
      <div className="crash-history-strip" aria-label="Geçmiş Turlar">
        {history.map((item, idx) => {
          const itemTier = getMultiplierTier(item);
          return (
            <span key={idx} className={`crash-pill ${itemTier}`}>
              {formatMultiplier(item)}
            </span>
          );
        })}
      </div>

      {/* Real-time Candlestick Canvas & HUD */}
      <div className="crash-canvas-container">
        <canvas ref={canvasRef} className="crash-canvas" />

        {/* Central Multiplier HUD */}
        <div className="multiplier-hud">
          {phase === 'countdown' ? (
            <span
              className="multiplier-value"
              style={{ color: 'var(--accent)' }}
            >
              {countdown}
            </span>
          ) : (
            <span
              className={`multiplier-value ${tier}`}
              style={{
                transform:
                  phase === 'running' ? `scale(${heartbeatPulse})` : undefined,
              }}
            >
              {formatMultiplier(multiplier)}
            </span>
          )}

          <span className="crash-status-sub">
            {phase === 'idle'
              ? 'PİYASA BEKLEMEDE'
              : phase === 'countdown'
                ? 'ROKET ATEŞLENİYOR...'
                : phase === 'running'
                  ? 'BOĞA RALLİSİ YÜKSELİYOR'
                  : phase === 'cashed_out'
                    ? `KÂR ALINDI @ ${formatMultiplier(cashOutMultiplier ?? 1)}`
                    : `PİYASA ÇÖKTÜ @ ${formatMultiplier(crashPoint)}`}
          </span>
        </div>

        {/* Floating Profit Toast */}
        {cashoutProfitToast !== null && (
          <div className="crash-victory-toast">
            🎉 +₺{cashoutProfitToast} KÂR ALINDI!
          </div>
        )}
      </div>

      {/* Stake Selector */}
      <div className="crash-stake-bar">
        <div className="crash-stake-top-row">
          <span className="crash-stake-label">Yatırım Tutarı</span>
          <span className="crash-stake-balance">
            Bakiye: <strong>{playerCash} Nakit</strong>
          </span>
        </div>

        <div className="crash-stake-input-group">
          <div
            className={`crash-stake-input-wrapper ${!isStakeValid ? 'has-error' : ''}`}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="crash-stake-input"
              value={rawStakeInput}
              onChange={(e) => handleStakeInputChange(e.target.value)}
              onBlur={handleStakeBlur}
              disabled={phase === 'running' || phase === 'countdown'}
              aria-label="Yatırım Tutarı"
              placeholder={`Min ${MIN_STAKE}`}
            />
            <span className="crash-stake-currency">NAKİT</span>
          </div>
        </div>

        {/* Real-time Validation Error / Hint */}
        {!isStakeValid && validationMessage && (
          <div className="crash-stake-validation-msg" role="alert">
            {validationMessage}
          </div>
        )}

        <div className="crash-chips-row">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`crash-chip-btn ${stake === chip ? 'active' : ''}`}
              onClick={() => handleSelectChip(chip)}
              disabled={phase === 'running' || phase === 'countdown'}
            >
              +{chip}
            </button>
          ))}
          <button
            type="button"
            className="crash-chip-btn"
            onClick={handleMaxStake}
            disabled={phase === 'running' || phase === 'countdown'}
          >
            MAKS
          </button>
        </div>
      </div>

      {/* Main Action Button */}
      {phase === 'running' ? (
        <button className="crash-main-btn cashout" onClick={handleCashOut}>
          KÂRI AL (+{potentialProfit} KÂR · {potentialPayout} TOPLAM)
        </button>
      ) : phase === 'countdown' ? (
        <button className="crash-main-btn start" disabled>
          ATEŞLENİYOR... ({countdown})
        </button>
      ) : (
        <button
          className="crash-main-btn start"
          onClick={handleStartRound}
          disabled={!isStakeValid}
        >
          🚀 BOĞA BAŞLAT ({isStakeValid ? stake : 0} NAKİT)
        </button>
      )}

      {/* Victory Brag Card */}
      {phase === 'cashed_out' && cashOutMultiplier && (
        <div
          className="crash-brag-card"
          style={{
            marginTop: '12px',
            padding: '14px 18px',
            borderRadius: '12px',
            background:
              'linear-gradient(135deg, rgba(234, 179, 8, 0.18), rgba(34, 197, 94, 0.18))',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: 800, color: '#facc15' }}>
            🎉 Harika Çıkış! {cashOutMultiplier.toFixed(2)}× Çarpan
          </span>
          <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
            Arkadaşlarına hava at ve davet ederek ekstra +5.000 Nakit ve binde 1 ciro primi kazan!
          </span>
          <button
            type="button"
            className="button"
            onClick={() => {
              const link = referralLink || 'https://t.me/ProjectEmpireBot';
              const multText = `${cashOutMultiplier.toFixed(2)}x`;
              const profitText = cashoutProfitToast ? `+${formatNumber(cashoutProfitToast)} Nakit` : 'büyük kâr';
              const text = `🔥 Crypto Crash'te ${multText} çarpan yakaladım ve tam ${profitText} kazandım! 🚀 Sen de katıl, +5.000 Nakit hoş geldin bonusuyla başla: `;
              const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
              if (window.Telegram?.WebApp?.openTelegramLink) {
                window.Telegram.WebApp.openTelegramLink(shareUrl);
              } else {
                window.open(shareUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontWeight: 800,
              fontSize: '14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
              color: '#0a0e17',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>📢</span>
            <span>Zaferini Paylaş & Hava At</span>
          </button>
        </div>
      )}
    </div>
  );
}
