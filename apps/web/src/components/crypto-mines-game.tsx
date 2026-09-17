import React, { useState } from 'react';
import {
  MINES_GRID_SIZE,
  MIN_MINES_STAKE,
  DEFAULT_MINES,
  startMinesGame,
  clickMinesTile,
  cashoutMinesGame,
  type MinesGameState,
} from '../game/crypto-mines-model';
import { formatNumber } from '../game/ui';
import {
  playClickSound,
  playWinSound,
  playFailSound,
} from '../game/arcade-audio';
import { triggerHaptic } from '../game/arcade-haptics';
import './arcade.css';

export interface CryptoMinesGameProps {
  playerCash?: number | undefined;
  onCashUpdated?: ((newCash: number) => void) | undefined;
  preview?: boolean | undefined;
  referralLink?: string | undefined;
}

const QUICK_CHIPS = [10, 50, 100, 500, 1000];
const MINE_OPTIONS = [1, 3, 5, 10, 15, 20];

export function CryptoMinesGame({
  playerCash = 10000,
  onCashUpdated,
  preview = false,
  referralLink,
}: CryptoMinesGameProps) {
  void preview;
  const [stakeInput, setStakeInput] = useState<string>('100');
  const [mineCount, setMineCount] = useState<number>(DEFAULT_MINES);
  const [gameState, setGameState] = useState<MinesGameState>({
    status: 'idle',
    stake: 100,
    mineCount: DEFAULT_MINES,
    mineLocations: [],
    revealedTiles: [],
    currentMultiplier: 1.0,
    nextMultiplier: 1.15,
    payoutCash: 0,
    startTime: 0,
  });

  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const numericStake = Number(stakeInput) || 0;
  const isPlaying = gameState.status === 'playing';

  const handleStart = () => {
    if (numericStake < MIN_MINES_STAKE) {
      setMessage(`Minimum bahis ${MIN_MINES_STAKE} Nakit olmalıdır.`);
      return;
    }
    if (numericStake > playerCash) {
      setMessage('Yetersiz bakiye!');
      return;
    }

    // Deduct stake from cash
    const remaining = playerCash - numericStake;
    if (onCashUpdated) {
      onCashUpdated(remaining);
    }

    playClickSound();
    triggerHaptic('impact_light');
    setMessage(null);

    const newGame = startMinesGame(numericStake, mineCount);
    setGameState(newGame);
  };

  const handleTileClick = (index: number) => {
    if (!isPlaying) return;
    if (gameState.revealedTiles.includes(index)) return;

    const { nextState, hitMine, gemsRevealed } = clickMinesTile(
      gameState,
      index,
    );

    if (hitMine) {
      playFailSound();
      triggerHaptic('notification_error');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setMessage('💥 Mayına bastın! Bahis kaybedildi.');
    } else {
      playWinSound();
      triggerHaptic('impact_medium');
      if (nextState.status === 'cashed_out') {
        // Automatically won (all safe tiles cleared!)
        const newTotal = playerCash + nextState.payoutCash;
        if (onCashUpdated) onCashUpdated(newTotal);
        setMessage(
          `🎉 EFSANE! Tüm elmaslar toplandı: +${formatNumber(nextState.payoutCash)} Nakit!`,
        );
      }
    }

    setGameState(nextState);
    void gemsRevealed;
  };

  const handleCashout = () => {
    if (!isPlaying || gameState.revealedTiles.length === 0) return;

    const { nextState, payoutCash, netProfit } = cashoutMinesGame(gameState);
    setGameState(nextState);

    playWinSound();
    triggerHaptic('notification_success');

    const newCash = playerCash + payoutCash;
    if (onCashUpdated) {
      onCashUpdated(newCash);
    }

    setMessage(
      `💰 Kâr Alındı! ${nextState.currentMultiplier.toFixed(2)}x çarpanla +${formatNumber(payoutCash)} Nakit kasaya eklendi (Net Kâr: +${formatNumber(netProfit)}).`,
    );
  };

  return (
    <div
      className={`crypto-mines-game ${shake ? 'is-crash-shake' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        background: 'linear-gradient(180deg, #111827 0%, #0a0e17 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(234, 179, 8, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
      }}
    >
      {/* Top Info Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px' }}>💣</span>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 800,
                color: '#f59e0b',
              }}
            >
              Kripto Mayın Tarlası
            </h3>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Her elmas çarpanı katlar. İstediğin an kârı al ve kaç!
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}
          >
            Kasa
          </span>
          <strong style={{ fontSize: '15px', color: '#22c55e' }}>
            {formatNumber(playerCash)} Nakit
          </strong>
        </div>
      </div>

      {/* Multiplier & Payout Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}
      >
        <div>
          <span
            style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}
          >
            Mevcut Çarpan
          </span>
          <strong
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color:
                isPlaying && gameState.currentMultiplier > 1
                  ? '#eab308'
                  : '#cbd5e1',
              textShadow: isPlaying
                ? '0 0 12px rgba(234, 179, 8, 0.5)'
                : 'none',
            }}
          >
            {gameState.currentMultiplier.toFixed(2)}x
          </strong>
        </div>

        <div>
          <span
            style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}
          >
            Sonraki Elmas
          </span>
          <strong
            style={{ fontSize: '22px', fontWeight: 900, color: '#38bdf8' }}
          >
            {isPlaying ? `${gameState.nextMultiplier.toFixed(2)}x` : '-'}
          </strong>
        </div>
      </div>

      {/* 5x5 Mines Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          width: '100%',
          maxWidth: '360px',
          margin: '0 auto',
        }}
      >
        {Array.from({ length: MINES_GRID_SIZE }).map((_, idx) => {
          const isRevealed = gameState.revealedTiles.includes(idx);
          const isMineLocation = gameState.mineLocations.includes(idx);
          const showGameOverMines =
            (gameState.status === 'busted' ||
              gameState.status === 'cashed_out') &&
            isMineLocation;

          let content = '❓';
          let bgColor = 'rgba(30, 41, 59, 0.8)';
          let borderColor = 'rgba(255, 255, 255, 0.1)';

          if (isRevealed) {
            if (isMineLocation) {
              content = '💥';
              bgColor = 'linear-gradient(135deg, #ef4444, #991b1b)';
              borderColor = '#ef4444';
            } else {
              content = '💎';
              bgColor = 'linear-gradient(135deg, #0284c7, #0369a1)';
              borderColor = '#38bdf8';
            }
          } else if (showGameOverMines) {
            content = '💣';
            bgColor = 'rgba(239, 68, 68, 0.2)';
            borderColor = 'rgba(239, 68, 68, 0.4)';
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleTileClick(idx)}
              disabled={!isPlaying || isRevealed}
              style={{
                aspectRatio: '1',
                borderRadius: '10px',
                background: bgColor,
                border: `2px solid ${borderColor}`,
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isPlaying && !isRevealed ? 'pointer' : 'default',
                transform: isRevealed ? 'scale(0.95)' : 'scale(1)',
                transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                boxShadow: isRevealed
                  ? '0 0 14px rgba(56, 189, 248, 0.4)'
                  : 'none',
              }}
            >
              {isRevealed || showGameOverMines ? content : ''}
            </button>
          );
        })}
      </div>

      {/* Feedback Message */}
      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background:
              gameState.status === 'busted'
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(34, 197, 94, 0.15)',
            border:
              gameState.status === 'busted'
                ? '1px solid #ef4444'
                : '1px solid #22c55e',
            color: gameState.status === 'busted' ? '#fca5a5' : '#86efac',
            fontSize: '13px',
            textAlign: 'center',
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      )}

      {gameState.status === 'cashed_out' && (
        <button
          type="button"
          className="button"
          onClick={() => {
            const link = referralLink || 'https://t.me/ProjectEmpireBot';
            const multText = `${gameState.currentMultiplier.toFixed(2)}x`;
            const profitText = `+${formatNumber(gameState.payoutCash)} Nakit`;
            const text = `💎 Mayın Tarlası'nda ${gameState.revealedTiles.length} elmas bulup ${multText} çarpanla ${profitText} kazandım! 💣 Sen de katıl, +5.000 Nakit hoş geldin bonusuyla başla: `;
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
            background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
            color: '#0a0e17',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
          }}
        >
          🚀 Arkadaşlarına Hava At (+5.000 Bonus Daveti)
        </button>
      )}

      {/* Game Action Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isPlaying ? (
          <button
            type="button"
            className="button"
            onClick={handleCashout}
            disabled={gameState.revealedTiles.length === 0}
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 900,
              background:
                gameState.revealedTiles.length > 0
                  ? 'linear-gradient(135deg, #f59e0b 0%, #22c55e 100%)'
                  : '#475569',
              color: '#0a0e17',
              border: 'none',
              borderRadius: '12px',
              cursor:
                gameState.revealedTiles.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow:
                gameState.revealedTiles.length > 0
                  ? '0 0 20px rgba(34, 197, 94, 0.5)'
                  : 'none',
              animation:
                gameState.revealedTiles.length > 0
                  ? 'neonEnergyWave 1.5s infinite'
                  : 'none',
            }}
          >
            💰 KÂRI AL (
            {gameState.payoutCash > 0
              ? `+${formatNumber(gameState.payoutCash)} Nakit`
              : 'En az 1 elmas aç'}
            )
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={handleStart}
            disabled={numericStake <= 0 || numericStake > playerCash}
            style={{
              padding: '14px',
              fontSize: '16px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
              color: '#0a0e17',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(234, 179, 8, 0.3)',
            }}
          >
            🎮 OYUNA BAŞLA ({formatNumber(numericStake)} Nakit)
          </button>
        )}

        {/* Stake & Mines Settings (Only adjustable when idle) */}
        {!isPlaying && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {/* Stake Input */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginBottom: '4px',
                }}
              >
                <span>Yatırılacak Bahis (Nakit)</span>
                <span>Min: 10</span>
              </div>
              <input
                type="number"
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                min={MIN_MINES_STAKE}
                max={playerCash}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 800,
                  boxSizing: 'border-box',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '6px',
                  flexWrap: 'wrap',
                }}
              >
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setStakeInput(String(chip))}
                    style={{
                      flex: '1 1 calc(20% - 6px)',
                      padding: '6px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#cbd5e1',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +{chip}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setStakeInput(String(playerCash))}
                  style={{
                    flex: '1 1 calc(20% - 6px)',
                    padding: '6px',
                    borderRadius: '6px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid #eab308',
                    color: '#facc15',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  MAKS
                </button>
              </div>
            </div>

            {/* Mine Count Selector */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginBottom: '4px',
                }}
              >
                <span>Mayın Sayısı (Risk Seviyesi)</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                  {mineCount} Mayın
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {MINE_OPTIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMineCount(m)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      background:
                        mineCount === m
                          ? '#f59e0b'
                          : 'rgba(255, 255, 255, 0.06)',
                      color: mineCount === m ? '#0a0e17' : '#cbd5e1',
                      border:
                        mineCount === m
                          ? '1px solid #fbbf24'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
