import React, { useEffect, useRef, useState } from 'react';
import {
  calculateCrashPayout,
  calculateCrashProfit,
  calculateMultiplierAtTime,
  DEFAULT_STAKES,
  formatMultiplier,
  generateCrashPoint,
  generateNextCandle,
  getMultiplierTier,
  type Candlestick,
} from '../game/crypto-crash-model';
import {
  playCrashSound,
  playTapSound,
  playWinSound,
} from '../game/arcade-audio';
import { hapticCrash, hapticSuccess, hapticTap } from '../game/arcade-haptics';
import './arcade.css';

export interface CryptoCrashGameProps {
  playerCash?: number;
  onReward?: (amount: number) => void;
  preview?: boolean;
}

type GamePhase = 'idle' | 'countdown' | 'running' | 'cashed_out' | 'crashed';

export function CryptoCrashGame({
  playerCash = 1000,
  onReward,
}: CryptoCrashGameProps) {
  const [phase, setPhase] = useState<GamePhase>('idle');
  const [stake, setStake] = useState<number>(100);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [crashPoint, setCrashPoint] = useState<number>(2.0);
  const [countdown, setCountdown] = useState<number>(3);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(
    null,
  );
  const [history, setHistory] = useState<number[]>([
    1.45, 3.2, 1.15, 8.4, 2.1, 14.8,
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const candlesRef = useRef<Candlestick[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastCandleTimeRef = useRef<number>(0);
  const countTimerRef = useRef<number | null>(null);
  const hasCashedOutRef = useRef(false);

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

    // Trailing Curve Line
    if (candles.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = isCrashed
        ? '#ff9e9e'
        : currentMult >= 10.0
          ? '#ffd700'
          : '#7ed2ad';
      ctx.lineWidth = 2.5;
      candles.forEach((c, idx) => {
        const x = startX + idx * spacing;
        const y = getY(c.close);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Glowing head
      const lastX = startX + (candles.length - 1) * spacing;
      const lastY = getY(candles[candles.length - 1]!.close);

      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
      ctx.fillStyle = isCrashed ? '#ff9e9e' : '#ffffff';
      ctx.fill();
      ctx.shadowColor = isCrashed ? '#ff9e9e' : '#7ed2ad';
      ctx.shadowBlur = 10;
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
    };
  }, []);

  // Initial render of empty/sample chart
  useEffect(() => {
    drawChart(1.0, false);
  }, []);

  function handleStartRound() {
    if (phase !== 'idle' && phase !== 'crashed' && phase !== 'cashed_out')
      return;
    if (stake <= 0) return;

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

    const payout = calculateCrashPayout(stake, securedMult);
    playWinSound();
    hapticSuccess();
    if (onReward) onReward(payout);
  }

  const tier = getMultiplierTier(multiplier);
  const potentialPayout = calculateCrashPayout(stake, multiplier);
  const potentialProfit = calculateCrashProfit(stake, multiplier);

  return (
    <div className="crypto-crash-game" aria-label="Kripto Mum Çöküş Oyunu">
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
            <span className={`multiplier-value ${tier}`}>
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
      </div>

      {/* Stake Selector */}
      <div className="crash-stake-bar">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
          }}
        >
          <span style={{ color: 'var(--muted)' }}>Yatırım Tutarı</span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>
            {stake} Nakit
          </span>
        </div>

        <div className="crash-chips-row">
          {DEFAULT_STAKES.map((chip) => (
            <button
              key={chip}
              className={`crash-chip-btn ${stake === chip ? 'active' : ''}`}
              onClick={() => {
                setStake(chip);
                playTapSound();
              }}
              disabled={phase === 'running' || phase === 'countdown'}
            >
              +{chip}
            </button>
          ))}
          <button
            className="crash-chip-btn"
            onClick={() => {
              setStake(Math.min(playerCash, 5000));
              playTapSound();
            }}
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
          disabled={stake > playerCash && playerCash > 0}
        >
          🚀 BOĞA BAŞLAT ({stake} NAKİT)
        </button>
      )}
    </div>
  );
}
