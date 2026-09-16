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
} from '../game/arcade-audio';
import { hapticMerge, hapticSuccess, hapticTap } from '../game/arcade-haptics';
import './arcade.css';

export interface CatizenMergeGameProps {
  autoMerge?: boolean;
  onReward?: (amount: number) => void;
  preview?: boolean;
}

export function CatizenMergeGame({
  autoMerge: initialAutoMerge = false,
  onReward,
}: CatizenMergeGameProps) {
  const [board, setBoard] = useState<MergeSlot[]>(() => createInitialBoard());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [autoBotActive, setAutoBotActive] = useState<boolean>(initialAutoMerge);
  const [accumulatedCash, setAccumulatedCash] = useState<number>(0);
  const [lastMergedTier, setLastMergedTier] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string>(
    'Eşit kademedeki eşyaları sürükle veya seçerek birleştir!',
  );

  const autoBotTimerRef = useRef<number | null>(null);
  const parcelTimerRef = useRef<number | null>(null);
  const dpsTimerRef = useRef<number | null>(null);
  const boardRef = useRef<MergeSlot[]>(board);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Sync prop changes for autoMerge
  useEffect(() => {
    if (initialAutoMerge !== autoBotActive) {
      setAutoBotActive(initialAutoMerge);
    }
  }, [initialAutoMerge]);

  // Mystery Parcel Spawner every 18 seconds
  useEffect(() => {
    parcelTimerRef.current = window.setInterval(() => {
      const currentBoard = boardRef.current;
      const spawned = spawnParcel(currentBoard);
      if (spawned) {
        boardRef.current = spawned.board;
        setBoard(spawned.board);
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

      {/* 4x3 Grid */}
      <div className="catizen-grid" role="grid" aria-label="Birleştirme Alanı">
        {board.map((slot, index) => {
          const isSelected = selectedSlot === index;
          const isDragOver = dragOverIndex === index;

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
                className="catizen-slot parcel-slot"
                onClick={() => handleSlotClick(index)}
                aria-label={`Gizemli hediye paketi ${index + 1}`}
              >
                <div className="catizen-parcel">
                  <span className="catizen-parcel-icon">🎁</span>
                  <span className="catizen-parcel-badge">AÇ</span>
                </div>
              </button>
            );
          }

          const tierDef = getTierDefinition(slot.tier);

          return (
            <button
              key={slot.id}
              className={`catizen-slot ${isSelected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
              onClick={() => handleSlotClick(index)}
              draggable
              onDragStart={(e) => handleDragStart(index, e)}
              onDragOver={(e) => handleDragOver(index, e)}
              onDrop={(e) => handleDrop(index, e)}
              style={{
                borderColor: isSelected ? 'var(--accent)' : tierDef.accentColor,
              }}
              aria-label={`${index + 1}. kare, ${tierDef.name}, Kademe ${slot.tier}`}
            >
              <div className="catizen-item">
                <span className="catizen-item-icon">{tierDef.iconSymbol}</span>
                <span className="catizen-item-tier">K.{slot.tier}</span>
                <span className="catizen-item-dps">+{tierDef.dps}/s</span>
              </div>
            </button>
          );
        })}
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
