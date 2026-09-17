import React, { useEffect, useRef, useState } from 'react';
import {
  calculateBoardDps,
  createInitialBoard,
  executeMerge,
  findAutoMergeCandidate,
  findFirstParcel,
  getMergeFee,
  getTierDefinition,
  moveOrSwapSlot,
  openParcel,
  spawnParcel,
  type MergeSlot,
} from '../game/catizen-merge-model';
import {
  playMergeSound,
  playTapSound,
  playUnboxSound,
  playWinSound,
} from '../game/arcade-audio';
import { hapticMerge, hapticSuccess, hapticTap } from '../game/arcade-haptics';
import './arcade.css';

const MERGE_STORAGE_KEY = 'empire_catizen_board_v1';

export interface CatizenMergeGameProps {
  autoMerge?: boolean;
  onReward?: (amount: number) => void;
  preview?: boolean;
}

export function getTierCyberLuxeStyle(tier: number, baseAccent?: string) {
  const hue = (tier * 37.5) % 360;
  const glow = Math.min(24, Math.round(6 + tier * 0.18));
  const eraIndex = Math.min(10, Math.max(1, Math.ceil(tier / 10)));

  if (tier <= 12 && baseAccent) {
    return {
      borderColor: baseAccent,
      background: `linear-gradient(135deg, rgba(24, 30, 41, 0.95), ${baseAccent}22)`,
      boxShadow: `0 0 ${glow}px ${baseAccent}44`,
      accentColor: baseAccent,
    };
  }

  switch (eraIndex) {
    case 2: // Tiers 11-20 (Quantum Silicon)
      return {
        borderColor: `hsl(${hue}, 100%, 65%)`,
        background: `linear-gradient(135deg, rgba(16, 20, 32, 0.95), hsl(${hue}, 90%, 25%) 120%)`,
        boxShadow: `0 0 ${glow}px hsl(${hue}, 100%, 55%, 0.45)`,
        accentColor: `hsl(${hue}, 100%, 65%)`,
      };
    case 3: // Tiers 21-30 (Neural Synthetics)
      return {
        borderColor: `hsl(${hue}, 95%, 60%)`,
        background: `linear-gradient(145deg, rgba(10, 24, 28, 0.95), hsl(${hue}, 80%, 20%) 130%)`,
        boxShadow: `0 0 ${glow}px hsl(${hue}, 95%, 50%, 0.5)`,
        accentColor: `hsl(${hue}, 95%, 60%)`,
      };
    case 4: // Tiers 31-40 (Orbital Core)
      return {
        borderColor: `hsl(${hue}, 90%, 65%)`,
        background: `linear-gradient(135deg, rgba(18, 12, 34, 0.95), hsl(${hue}, 85%, 25%) 120%)`,
        boxShadow: `0 0 ${glow}px hsl(${hue}, 90%, 55%, 0.55)`,
        accentColor: `hsl(${hue}, 90%, 65%)`,
      };
    case 5: // Tiers 41-50 (Dark Matter Void)
      return {
        borderColor: '#bb86fc',
        background: 'linear-gradient(135deg, #0a0814 0%, #1e1035 100%)',
        boxShadow: `0 0 ${glow}px rgba(187, 134, 252, 0.55)`,
        accentColor: '#bb86fc',
      };
    case 6: // Tiers 51-60 (Stellar Fusion)
      return {
        borderColor: '#ff6600',
        background: 'linear-gradient(135deg, #1c0a05 0%, #4a1505 100%)',
        boxShadow: `0 0 ${glow}px rgba(255, 102, 0, 0.6)`,
        accentColor: '#ff9900',
      };
    case 7: // Tiers 61-70 (Tachyon Warp)
      return {
        borderColor: '#00ffff',
        background: 'linear-gradient(135deg, #05141c 0%, #0d384a 100%)',
        boxShadow: `0 0 ${glow}px rgba(0, 255, 255, 0.65)`,
        accentColor: '#00ffff',
      };
    case 8: // Tiers 71-80 (Chrono Nexus)
      return {
        borderColor: '#ffd700',
        background: 'linear-gradient(135deg, #1f1a05 0%, #4a3e0a 100%)',
        boxShadow: `0 0 ${glow}px rgba(255, 215, 0, 0.7)`,
        accentColor: '#ffd700',
      };
    case 9: // Tiers 81-90 (Multiverse Singularity)
      return {
        borderColor: '#ff00aa',
        background: 'linear-gradient(135deg, #1f0518 0%, #4a0d3b 100%)',
        boxShadow: `0 0 ${glow}px rgba(255, 0, 170, 0.75)`,
        accentColor: '#ff00aa',
      };
    case 10: // Tiers 91-100 (God-Engine / Transcendent)
    default:
      return {
        borderColor: '#ffffff',
        background:
          'linear-gradient(135deg, #1f1b29 0%, #483d66 50%, #ffffff22 100%)',
        boxShadow: `0 0 ${glow + 4}px rgba(255, 255, 255, 0.85), inset 0 0 12px rgba(255, 215, 0, 0.4)`,
        accentColor: '#ffffff',
      };
  }
}

interface MergeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'star' | 'circle' | 'ribbon';
  alpha: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
}

export function CatizenMergeGame({
  autoMerge: initialAutoMerge = false,
  onReward,
}: CatizenMergeGameProps) {
  const [board, setBoard] = useState<MergeSlot[]>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(MERGE_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as MergeSlot[];
          if (Array.isArray(parsed) && parsed.length === 12) {
            return parsed;
          }
        }
      } catch {
        // Fallback to fresh board
      }
    }
    return createInitialBoard();
  });
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [autoBotActive, setAutoBotActive] = useState<boolean>(initialAutoMerge);
  const [accumulatedCash, setAccumulatedCash] = useState<number>(0);
  const [lastMergedTier, setLastMergedTier] = useState<number | null>(null);
  const [mergedSlotIndex, setMergedSlotIndex] = useState<number | null>(null);
  const [droppingSlotIndex, setDroppingSlotIndex] = useState<number | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string>(
    'Eşit kademedeki eşyaları sürükle veya seçerek birleştir!',
  );

  const autoBotTimerRef = useRef<number | null>(null);
  const parcelTimerRef = useRef<number | null>(null);
  const dpsTimerRef = useRef<number | null>(null);
  const boardRef = useRef<MergeSlot[]>(board);
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<MergeParticle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isLoopRunningRef = useRef(false);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    boardRef.current = board;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(MERGE_STORAGE_KEY, JSON.stringify(board));
      } catch {
        // Ignore storage errors
      }
    }
  }, [board]);

  // Sync prop changes for autoMerge
  useEffect(() => {
    if (initialAutoMerge !== autoBotActive) {
      setAutoBotActive(initialAutoMerge);
    }
  }, [initialAutoMerge]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  function startParticleLoop() {
    if (isLoopRunningRef.current) return;
    isLoopRunningRef.current = true;

    function render() {
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
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.vx *= 0.97; // air drag
        p.alpha -= p.decay;
        p.rotation += p.rotSpeed;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'star') {
          // Draw 4-point star
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          for (let s = 0; s < 4; s++) {
            ctx.rotate(Math.PI / 2);
            ctx.lineTo(p.size * 1.6, 0);
            ctx.lineTo(p.size * 0.4, p.size * 0.4);
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.shape === 'ribbon') {
          // Spinning confetti ribbon
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        } else {
          // Glow spark
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();

      if (particles.length > 0) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        isLoopRunningRef.current = false;
      }
    }

    animFrameRef.current = requestAnimationFrame(render);
  }

  function spawnMergeExplosion(slotIndex: number, accentColor: string) {
    setMergedSlotIndex(slotIndex);
    window.setTimeout(() => setMergedSlotIndex(null), 500);

    const canvas = particleCanvasRef.current;
    const grid = gridContainerRef.current?.querySelector('.catizen-grid');
    if (!canvas || !grid) return;

    const slotEl = grid.children[slotIndex] as HTMLElement | undefined;
    if (!slotEl) return;

    const gridRect = grid.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();

    const targetX = slotRect.left - gridRect.left + slotRect.width / 2;
    const targetY = slotRect.top - gridRect.top + slotRect.height / 2;

    const particles = particlesRef.current;
    if (particles.length > 160) {
      particles.splice(0, 40);
    }

    const count = 36;
    const colors = [accentColor, '#ffffff', '#ffd700', '#00e5ff', '#ff3366'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 3.5 + Math.random() * 5.5;
      const shapes: ('star' | 'circle' | 'ribbon')[] = [
        'star',
        'circle',
        'ribbon',
      ];
      particles.push({
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3.0 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        shape: shapes[Math.floor(Math.random() * shapes.length)]!,
        alpha: 1.0,
        decay: 0.025 + Math.random() * 0.02,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.25,
      });
    }

    startParticleLoop();
  }

  // Mystery Parcel Spawner every 18 seconds
  useEffect(() => {
    parcelTimerRef.current = window.setInterval(() => {
      const currentBoard = boardRef.current;
      const spawned = spawnParcel(currentBoard);
      if (spawned) {
        boardRef.current = spawned.board;
        setBoard(spawned.board);
        const spawnedIdx = spawned.board.findIndex(
          (s, i) => s?.type === 'parcel' && currentBoard[i]?.type !== 'parcel',
        );
        if (spawnedIdx !== -1) {
          setDroppingSlotIndex(spawnedIdx);
          window.setTimeout(() => setDroppingSlotIndex(null), 800);
        }
        setToastMessage('🎁 Gizemli paket indi! Açmak için dokun.');
      }
    }, 18000);

    return () => {
      if (parcelTimerRef.current) clearInterval(parcelTimerRef.current);
    };
  }, []);

  // Idle DPS accumulator (every 1 second)
  useEffect(() => {
    dpsTimerRef.current = window.setInterval(() => {
      const dps = calculateBoardDps(boardRef.current);
      if (dps > 0) {
        setAccumulatedCash((prev) => prev + dps);
      }
    }, 1000);

    return () => {
      if (dpsTimerRef.current) clearInterval(dpsTimerRef.current);
    };
  }, []);

  // Intelligent Auto-Bot assistant loop
  useEffect(() => {
    if (!autoBotActive) {
      if (autoBotTimerRef.current) clearInterval(autoBotTimerRef.current);
      return;
    }

    autoBotTimerRef.current = window.setInterval(() => {
      const currentBoard = boardRef.current;
      // 1. Open any pending parcels first
      const parcelIdx = findFirstParcel(currentBoard);
      if (parcelIdx !== null) {
        const opened = openParcel(currentBoard, parcelIdx);
        if (opened) {
          boardRef.current = opened.board;
          setBoard(opened.board);
          playUnboxSound();
          hapticTap();
          setToastMessage(`🤖 Bot paketi açtı: Kademe ${opened.tier}`);
          return;
        }
      }

      // 2. Find lowest matching pair to merge
      const pair = findAutoMergeCandidate(currentBoard);
      if (pair) {
        const [from, to] = pair;
        const merged = executeMerge(currentBoard, from, to);
        if (merged) {
          boardRef.current = merged.board;
          setBoard(merged.board);
          playMergeSound(merged.newTier);
          hapticMerge();
          setLastMergedTier(merged.newTier);
          spawnMergeExplosion(
            to,
            getTierDefinition(merged.newTier).accentColor,
          );
          if (onReward) onReward(merged.reward);
          setToastMessage(
            `🤖 Bot birleştirdi: ${getTierDefinition(merged.newTier).name} (+${merged.reward} Nakit)`,
          );
          return;
        }
      }
    }, 1500);

    return () => {
      if (autoBotTimerRef.current) clearInterval(autoBotTimerRef.current);
    };
  }, [autoBotActive, onReward]);

  // Collect passive earnings bank
  function collectEarnings() {
    if (accumulatedCash <= 0) return;
    const amount = accumulatedCash;
    setAccumulatedCash(0);
    playTapSound();
    hapticSuccess();
    if (onReward) onReward(amount);
    setToastMessage(`💰 +${amount} Kasa geliri toplandı!`);
  }

  // Handle Slot Click / Tap (accessible alternative to drag & drop)
  function handleSlotClick(index: number) {
    const slot = board[index];

    // Case 1: Click on parcel opens it immediately
    if (slot && slot.type === 'parcel') {
      const opened = openParcel(board, index);
      if (opened) {
        playUnboxSound();
        hapticTap();
        setBoard(opened.board);
        setToastMessage(
          `🎁 Paket açıldı: ${getTierDefinition(opened.tier).name}!`,
        );
      }
      setSelectedSlot(null);
      return;
    }

    // Case 2: No slot currently selected
    if (selectedSlot === null) {
      if (slot && slot.type === 'item') {
        setSelectedSlot(index);
        playTapSound();
        hapticTap();
        setToastMessage(`Kademe ${slot.tier} seçildi. Hedef kareye dokun.`);
      }
      return;
    }

    // Case 3: Same slot clicked -> unselect
    if (selectedSlot === index) {
      setSelectedSlot(null);
      return;
    }

    // Case 4: Destination slot clicked -> perform move or merge
    const result = moveOrSwapSlot(board, selectedSlot, index);
    if (!result) {
      setSelectedSlot(null);
      return;
    }

    setBoard(result.board);
    setSelectedSlot(null);

    if (result.merged && result.newTier) {
      playMergeSound(result.newTier);
      hapticMerge();
      setLastMergedTier(result.newTier);
      spawnMergeExplosion(index, getTierDefinition(result.newTier).accentColor);
      if (result.reward && onReward) onReward(result.reward);
      const fee = getMergeFee(result.newTier - 1);
      if (fee > 0 && onReward) onReward(-fee);
      setToastMessage(
        `✨ Birleşti! ${getTierDefinition(result.newTier).name} (Maliyet: -${fee} · +${result.reward} Nakit)`,
      );
    } else {
      playTapSound();
      hapticTap();
    }
  }

  // HTML5 / Pointer Drag & Drop handlers
  function handleDragStart(index: number, e: React.DragEvent) {
    const slot = board[index];
    if (!slot || slot.type !== 'item') {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    playTapSound();
  }

  function handleDragOver(index: number, e: React.DragEvent) {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(toIndex: number, e: React.DragEvent) {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex === null || draggedIndex === toIndex) {
      setDraggedIndex(null);
      return;
    }

    const result = moveOrSwapSlot(board, draggedIndex, toIndex);
    setDraggedIndex(null);
    if (!result) return;

    setBoard(result.board);
    if (result.merged && result.newTier) {
      playMergeSound(result.newTier);
      hapticMerge();
      setLastMergedTier(result.newTier);
      spawnMergeExplosion(
        toIndex,
        getTierDefinition(result.newTier).accentColor,
      );
      if (result.reward && onReward) onReward(result.reward);
      const fee = getMergeFee(result.newTier - 1);
      if (fee > 0 && onReward) onReward(-fee);
      setToastMessage(
        `✨ Birleşti! ${getTierDefinition(result.newTier).name} (Maliyet: -${fee} · +${result.reward} Nakit)`,
      );
    } else {
      playTapSound();
      hapticTap();
    }
  }

  function handleCollectBank() {
    if (accumulatedCash <= 0) return;
    const amount = accumulatedCash;
    setAccumulatedCash(0);
    playWinSound();
    hapticSuccess();
    if (onReward) {
      onReward(amount);
    }
    setToastMessage(`💰 Kasadaki +${amount.toLocaleString()} Nakit hesabına aktarıldı!`);
  }

  const currentDps = calculateBoardDps(board);

  return (
    <div className="catizen-game" aria-label="Catizen Birleştirme Oyunu">
      {/* Top HUD */}
      <div className="catizen-top-stats">
        <div className="catizen-stat-pill">
          <span className="label">Üretim Hızı</span>
          <strong>⚡ +{currentDps}/sn</strong>
        </div>
        <div className="catizen-stat-pill">
          <span className="label">Kasa Bankası</span>
          <strong>🪙 {accumulatedCash}</strong>
          {accumulatedCash > 0 && (
            <button
              type="button"
              className="catizen-collect-btn"
              onClick={handleCollectBank}
              aria-label="Kasadaki nakdi topla"
              style={{
                marginLeft: '6px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Topla
            </button>
          )}
        </div>
        {lastMergedTier && (
          <div className="catizen-stat-pill">
            <span className="label">Son Kademe</span>
            <strong>K.{lastMergedTier}</strong>
          </div>
        )}
        <button
          className={`catizen-auto-btn ${autoBotActive ? 'active' : ''}`}
          onClick={() => setAutoBotActive(!autoBotActive)}
          aria-pressed={autoBotActive}
        >
          {autoBotActive ? '🤖 Bot Aktif' : '🤖 Oto-Bot'}
        </button>
      </div>

      {/* 4x3 Grid with Particle Canvas */}
      <div
        ref={gridContainerRef}
        className="catizen-grid-wrapper"
        style={{ position: 'relative', width: '100%' }}
      >
        <canvas ref={particleCanvasRef} className="catizen-particle-canvas" />
        <div
          className="catizen-grid"
          role="grid"
          aria-label="Birleştirme Alanı"
        >
          {board.map((slot, index) => {
            const isSelected = selectedSlot === index;
            const isDragOver = dragOverIndex === index;
            const isMerged = mergedSlotIndex === index;
            const isDropping = droppingSlotIndex === index;

            if (!slot) {
              return (
                <button
                  key={`empty-${index}`}
                  className={`catizen-slot ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
                  onClick={() => handleSlotClick(index)}
                  onDragOver={(e) => handleDragOver(index, e)}
                  onDrop={(e) => handleDrop(index, e)}
                  aria-label={`Boş kare ${index + 1}`}
                />
              );
            }

            if (slot.type === 'parcel') {
              return (
                <button
                  key={slot.id}
                  className={`catizen-slot parcel-slot ${isDropping ? 'parcel-dropping' : ''}`}
                  onClick={() => handleSlotClick(index)}
                  aria-label={`Gizemli hediye paketi ${index + 1}`}
                >
                  <div
                    className={`catizen-parcel ${isDropping ? 'parcel-rumble' : ''}`}
                  >
                    <span className="catizen-parcel-icon">🎁</span>
                    <span className="catizen-parcel-badge">AÇ</span>
                  </div>
                </button>
              );
            }

            const tierDef = getTierDefinition(slot.tier);
            const luxe = getTierCyberLuxeStyle(slot.tier, tierDef.accentColor);

            return (
              <button
                key={slot.id}
                className={`catizen-slot ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''} ${isMerged ? 'slot-merged' : ''}`}
                onClick={() => handleSlotClick(index)}
                draggable
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDrop={(e) => handleDrop(index, e)}
                style={{
                  borderColor: isSelected ? 'var(--accent)' : luxe.borderColor,
                  background: luxe.background,
                  boxShadow: isSelected ? undefined : luxe.boxShadow,
                }}
                aria-label={`${index + 1}. kare, ${tierDef.name}, Kademe ${slot.tier}`}
              >
                <div className="catizen-item">
                  <span className="catizen-item-icon">
                    {tierDef.iconSymbol}
                  </span>
                  <span
                    className="catizen-item-tier"
                    style={{ borderColor: luxe.accentColor }}
                  >
                    K.{slot.tier}
                  </span>
                  <span className="catizen-item-dps">+{tierDef.dps}/s</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Controls & Toast */}
      <p className="micro-game-status" aria-live="polite">
        {toastMessage}
      </p>

      <div className="catizen-controls">
        <button
          className="button secondary"
          onClick={() => {
            const spawned = spawnParcel(board);
            if (spawned) {
              setBoard(spawned.board);
              const spawnedIdx = spawned.board.findIndex(
                (s, i) => s?.type === 'parcel' && board[i]?.type !== 'parcel',
              );
              if (spawnedIdx !== -1) {
                setDroppingSlotIndex(spawnedIdx);
                window.setTimeout(() => setDroppingSlotIndex(null), 800);
              }
              playUnboxSound();
              setToastMessage('🎁 Yeni paket çağrıldı!');
            } else {
              setToastMessage('Tahta tamamen dolu!');
            }
          }}
        >
          🎁 Paket Çağır
        </button>
        <button
          className="button primary"
          onClick={collectEarnings}
          disabled={accumulatedCash <= 0}
        >
          💰 Kasa Topla (+{accumulatedCash})
        </button>
      </div>
    </div>
  );
}
