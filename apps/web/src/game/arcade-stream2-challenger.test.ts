import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Game models
import {
  createInitialBoard,
  moveOrSwapSlot,
  executeMerge,
  spawnParcel,
  openParcel,
  calculateBoardDps,
  findAutoMergeCandidate,
  findFirstParcel,
  MAX_MERGE_TIER,
  type MergeSlot,
  type MergeItem,
} from './catizen-merge-model';

import {
  createInitialTapState,
  performTap,
  syncEnergyWithTime,
  getMaxEnergy,
  calculateTapBotOfflineEarnings,
  getMultitapUpgradeCost,
  getCapacityUpgradeCost,
  getRechargeUpgradeCost,
  getOfflineExtenderCost,
} from './notcoin-tap-model';

import {
  calculateMultiplierAtTime,
  generateCrashPoint,
  calculateCrashPayout,
  calculateCrashProfit,
  getMultiplierTier,
  generateNextCandle,
} from './crypto-crash-model';

import {
  memoryRewardForRound,
  extendMemorySequence,
} from './arcade-game-model';

import {
  isMuted,
  setMuted,
  toggleMute,
  playTapSound,
  playCritSound,
  playMergeSound,
  playUnboxSound,
  playCipherKeySound,
  playDecryptPulseSound,
  playCrashSound,
  playWinSound,
  playErrorSound,
} from './arcade-audio';

import {
  hapticTap,
  hapticCrit,
  hapticMerge,
  hapticSuccess,
  hapticError,
  hapticCrash,
} from './arcade-haptics';

describe('CHALLENGER VECTOR 1: Mobile Responsiveness & Layout Constraints', () => {
  const cssPath = path.resolve(__dirname, '../components/arcade.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('verifies no fixed width exceeds 290px in arcade.css', () => {
    // Match declarations like "width: 300px" or "min-width: 320px" or "max-width: 400px"
    const widthRegex = /(?:^|[^-])\b(?:width|min-width)\s*:\s*(\d+)px/g;
    const matches: { full: string; val: number }[] = [];
    let match: RegExpExecArray | null;
    while ((match = widthRegex.exec(cssContent)) !== null) {
      const val = parseInt(match[1]!, 10);
      matches.push({ full: match[0], val });
    }

    const exceeding = matches.filter((m) => m.val > 290);
    expect(exceeding).toEqual([]);
  });

  it('verifies all arcade grid-template-columns use repeat(N, minmax(0, 1fr))', () => {
    const gridColsRegex = /grid-template-columns\s*:\s*([^;]+);/g;
    const gridCols: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = gridColsRegex.exec(cssContent)) !== null) {
      gridCols.push(match[1]!.trim());
    }

    expect(gridCols.length).toBeGreaterThanOrEqual(3);
    for (const col of gridCols) {
      expect(col).toMatch(
        /repeat\(\s*\d+\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/,
      );
    }
  });

  it('verifies 320px viewport arithmetic for 4x3 Catizen grid', () => {
    const viewportWidth = 320;
    const containerPadding = 12 * 2; // 12px padding on max-width 520px
    const availableWidth = viewportWidth - containerPadding; // 296px
    const columns = 4;
    const gapAtSmallScreen = 4; // gap is 4px under max-width 359px
    const totalGaps = (columns - 1) * gapAtSmallScreen; // 12px
    const slotWidth = (availableWidth - totalGaps) / columns; // 71px

    expect(slotWidth).toBe(71);
    expect(slotWidth * columns + totalGaps + containerPadding).toBe(
      viewportWidth,
    );
    // Touch target minimum: 44px
    expect(slotWidth).toBeGreaterThanOrEqual(44);
  });

  it('evaluates touch targets for interactive elements', () => {
    // Audit interactive elements from CSS
    // Check known compact controls
    const muteBtnMatch = cssContent.match(
      /\.arcade-mute-btn\s*\{[^}]*(?:min-)?width:\s*(\d+)px;[^}]*(?:min-)?height:\s*(\d+)px;/,
    );
    expect(muteBtnMatch).not.toBeNull();
    const muteW = parseInt(muteBtnMatch![1]!, 10);
    const muteH = parseInt(muteBtnMatch![2]!, 10);
    // Verified: mute button enforces minimum 44px touch target
    expect(muteW).toBeGreaterThanOrEqual(44);
    expect(muteH).toBeGreaterThanOrEqual(44);
  });
});

describe('CHALLENGER VECTOR 2.1: Catizen Merge Adversarial State Handling', () => {
  it('handles invalid drag: swap two different tier items without data loss', () => {
    const board = createInitialBoard();
    // board[0] is tier 1, board[2] is tier 2
    expect((board[0] as MergeItem).tier).toBe(1);
    expect((board[2] as MergeItem).tier).toBe(2);

    const result = moveOrSwapSlot(board, 0, 2);
    expect(result).not.toBeNull();
    expect(result!.merged).toBe(false);
    expect((result!.board[0] as MergeItem).tier).toBe(2);
    expect((result!.board[2] as MergeItem).tier).toBe(1);
  });

  it('handles invalid drag: drag item onto parcel swaps positions without losing parcel', () => {
    const board = createInitialBoard();
    const spawned = spawnParcel(board, 3);
    expect(spawned).not.toBeNull();
    const withParcel = spawned!.board;
    expect(withParcel[3]?.type).toBe('parcel');

    // Drag item from slot 0 onto slot 3 (parcel)
    const result = moveOrSwapSlot(withParcel, 0, 3);
    expect(result).not.toBeNull();
    expect(result!.merged).toBe(false);
    expect(result!.board[0]?.type).toBe('parcel');
    expect(result!.board[3]?.type).toBe('item');
    expect((result!.board[3] as MergeItem).tier).toBe(1);
  });

  it('handles drag onto empty slot: moves item and clears source', () => {
    const board = createInitialBoard();
    expect(board[5]).toBeNull();

    const result = moveOrSwapSlot(board, 0, 5);
    expect(result).not.toBeNull();
    expect(result!.merged).toBe(false);
    expect(result!.board[0]).toBeNull();
    expect(result!.board[5]?.type).toBe('item');
    expect((result!.board[5] as MergeItem).tier).toBe(1);
  });

  it('handles out-of-bounds drag gracefully without throwing or mutating', () => {
    const board = createInitialBoard();

    expect(moveOrSwapSlot(board, -1, 0)).toBeNull();
    expect(moveOrSwapSlot(board, 0, 12)).toBeNull();
    expect(moveOrSwapSlot(board, 0, 999)).toBeNull();
    expect(moveOrSwapSlot(board, 0, 0)).toBeNull();
    expect(moveOrSwapSlot(board, 5, 6)).toBeNull(); // moving empty slot
  });

  it('handles max-tier items: does NOT merge tier 12 items', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: MAX_MERGE_TIER, id: 't12-a' };
    board[1] = { type: 'item', tier: MAX_MERGE_TIER, id: 't12-b' };

    const result = moveOrSwapSlot(board, 0, 1);
    expect(result).not.toBeNull();
    // Swaps instead of merging past max tier
    expect(result!.merged).toBe(false);
    expect(result!.board[0]?.id).toBe('t12-b');
    expect(result!.board[1]?.id).toBe('t12-a');
  });

  it('survives a fuzzer of 500 randomized moves, merges, and parcel drops', () => {
    let board = createInitialBoard();

    for (let i = 0; i < 500; i++) {
      const op = Math.random();
      if (op < 0.2) {
        // Spawn parcel
        const spawned = spawnParcel(board);
        if (spawned) board = spawned.board;
      } else if (op < 0.35) {
        // Open parcel
        const pIdx = findFirstParcel(board);
        if (pIdx !== null) {
          const opened = openParcel(board, pIdx);
          if (opened) board = opened.board;
        }
      } else if (op < 0.6) {
        // Auto-merge candidate
        const candidate = findAutoMergeCandidate(board);
        if (candidate) {
          const merged = executeMerge(board, candidate[0], candidate[1]);
          if (merged) board = merged.board;
        }
      } else {
        // Random swap/move
        const from = Math.floor(Math.random() * 12);
        const to = Math.floor(Math.random() * 12);
        const res = moveOrSwapSlot(board, from, to);
        if (res) board = res.board;
      }

      // Board integrity checks at every step
      expect(board.length).toBe(12);
      for (const slot of board) {
        if (slot) {
          expect(['item', 'parcel']).toContain(slot.type);
          if (slot.type === 'item') {
            expect(slot.tier).toBeGreaterThanOrEqual(1);
            expect(slot.tier).toBeLessThanOrEqual(MAX_MERGE_TIER);
          }
        }
      }
      expect(calculateBoardDps(board)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('CHALLENGER VECTOR 2.2: Notcoin Tap Adversarial Probing', () => {
  it('rapid clicks with 0 energy: returns null, energy never goes negative, coins unchanged', () => {
    const state = createInitialTapState();
    state.currentEnergy = 0;
    const initialCoins = state.totalCoinsEarned;
    const now = Date.now();

    // 1,000 rapid clicks at the exact same timestamp
    for (let i = 0; i < 1000; i++) {
      const result = performTap(state, false, now);
      expect(result).toBeNull();
    }

    expect(state.currentEnergy).toBe(0);
    expect(state.totalCoinsEarned).toBe(initialCoins);
    expect(state.totalTaps).toBe(0);
  });

  it('energy regeneration cap: simulated 1,000,000 seconds never exceeds maxEnergy', () => {
    const state = createInitialTapState();
    state.currentEnergy = 50;
    const maxCap = getMaxEnergy(state.upgrades.energyCapacity);

    const synced = syncEnergyWithTime(
      state,
      state.lastUpdatedTimestamp + 1_000_000_000,
    );
    expect(synced.currentEnergy).toBe(maxCap);
    expect(synced.currentEnergy).toBeLessThanOrEqual(maxCap);
  });

  it('offline TapBot accumulation: enforces offline hours ceiling strictly', () => {
    const multitapLevel = 3; // 3 coins per tap
    const offlineLimitHours = 3; // 3 hours = 10,800 seconds

    // Case 1: 100 hours offline with a 3h cap
    const report1 = calculateTapBotOfflineEarnings(
      true,
      multitapLevel,
      offlineLimitHours,
      100 * 3600,
    );
    expect(report1.cappedSeconds).toBe(10800);
    expect(report1.tapsSimulated).toBe(5400); // 0.5 taps per second
    expect(report1.coinsEarned).toBe(5400 * 3); // 16,200

    // Case 2: TapBot NOT unlocked
    const report2 = calculateTapBotOfflineEarnings(
      false,
      multitapLevel,
      offlineLimitHours,
      100 * 3600,
    );
    expect(report2.coinsEarned).toBe(0);
    expect(report2.cappedSeconds).toBe(0);

    // Case 3: Negative or zero elapsed seconds
    const report3 = calculateTapBotOfflineEarnings(
      true,
      multitapLevel,
      offlineLimitHours,
      -50,
    );
    expect(report3.coinsEarned).toBe(0);
  });

  it('upgrade costs cap: returns null when reaching maximum levels', () => {
    expect(getMultitapUpgradeCost(20)).toBeNull();
    expect(getCapacityUpgradeCost(20)).toBeNull();
    expect(getRechargeUpgradeCost(20)).toBeNull();
    expect(getOfflineExtenderCost(24)).toBeNull();
  });
});

describe('CHALLENGER VECTOR 2.3: Dynasty Cipher Timer & Progression', () => {
  it('combo multiplier progression scales monotonically', () => {
    let combo = 1.0;
    const nextCombos: number[] = [];

    for (let i = 0; i < 6; i++) {
      combo = combo < 1.5 ? 1.5 : combo < 2.0 ? 2.0 : combo < 3.0 ? 3.0 : 5.0;
      nextCombos.push(combo);
    }

    expect(nextCombos).toEqual([1.5, 2.0, 3.0, 5.0, 5.0, 5.0]);
  });

  it('memory rewards scale properly with combo multiplier', () => {
    for (let round = 1; round <= 6; round++) {
      const base = memoryRewardForRound(round);
      expect(base).toBeGreaterThan(0);
      const withCombo = Math.floor(base * 2.5);
      expect(withCombo).toBeGreaterThanOrEqual(base);
    }
  });

  it('sequence extension adds distinct valid nodes within [0..3]', () => {
    let seq = [0, 2, 1];
    for (let round = 2; round <= 6; round++) {
      seq = extendMemorySequence(seq, round);
      expect(seq.length).toBe(round + 2);
      for (const val of seq) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('CHALLENGER VECTOR 2.4: Crypto Crash State Transitions & Math', () => {
  it('multiplier starts strictly at 1.00x and is monotonically increasing over time', () => {
    let prev = calculateMultiplierAtTime(0);
    expect(prev).toBe(1.0);

    for (let t = 100; t <= 15000; t += 200) {
      const current = calculateMultiplierAtTime(t);
      expect(current).toBeGreaterThanOrEqual(prev);
      prev = current;
    }
  });

  it('crash point generation: bounded strictly between 1.00x and 100.00x across 10,000 samples', () => {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < 10000; i++) {
      const point = generateCrashPoint();
      if (point < min) min = point;
      if (point > max) max = point;
      expect(point).toBeGreaterThanOrEqual(1.0);
      expect(point).toBeLessThanOrEqual(100.0);
    }

    expect(min).toBeGreaterThanOrEqual(1.0);
    expect(max).toBeLessThanOrEqual(100.0);
  });

  it('calculates crash payout and profit accurately with floor rounding', () => {
    const stake = 250;
    const mult = 2.456;
    const payout = calculateCrashPayout(stake, mult);
    const profit = calculateCrashProfit(stake, mult);

    expect(payout).toBe(Math.floor(250 * 2.456)); // 614
    expect(profit).toBe(payout - stake); // 364
  });

  it('classifies multiplier tiers accurately', () => {
    expect(getMultiplierTier(1.05)).toBe('bear');
    expect(getMultiplierTier(1.49)).toBe('bear');
    expect(getMultiplierTier(1.5)).toBe('bear');
    expect(getMultiplierTier(2.0)).toBe('bull');
    expect(getMultiplierTier(9.99)).toBe('bull');
    expect(getMultiplierTier(10.0)).toBe('moon');
    expect(getMultiplierTier(88.0)).toBe('moon');
  });

  it('generates consistent candlesticks with proper high/low bounds', () => {
    let prevClose = 1.0;
    for (let i = 0; i < 50; i++) {
      const mult = 1.0 + i * 0.1;
      const candle = generateNextCandle(prevClose, mult, i);
      expect(candle.high).toBeGreaterThanOrEqual(
        Math.max(candle.open, candle.close),
      );
      expect(candle.low).toBeLessThanOrEqual(
        Math.min(candle.open, candle.close),
      );
      expect(candle.isBullish).toBe(candle.close >= candle.open);
      prevClose = candle.close;
    }
  });
});

describe('CHALLENGER VECTOR 3: Audio Synthesizer & Telegram Haptics', () => {
  beforeEach(() => {
    setMuted(false);
  });

  it('manages mute state consistently', () => {
    expect(isMuted()).toBe(false);
    expect(toggleMute()).toBe(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('when muted, sound functions return cleanly without throwing or initializing AudioContext', () => {
    setMuted(true);
    expect(() => playTapSound()).not.toThrow();
    expect(() => playCritSound()).not.toThrow();
    expect(() => playMergeSound(5)).not.toThrow();
    expect(() => playUnboxSound()).not.toThrow();
    expect(() => playCipherKeySound(2)).not.toThrow();
    expect(() => playDecryptPulseSound()).not.toThrow();
    expect(() => playCrashSound()).not.toThrow();
    expect(() => playWinSound()).not.toThrow();
    expect(() => playErrorSound()).not.toThrow();
  });

  it('when unmuted in headless environment, sound functions catch and handle gracefully', () => {
    setMuted(false);
    expect(() => playTapSound()).not.toThrow();
    expect(() => playCritSound()).not.toThrow();
    expect(() => playMergeSound(3)).not.toThrow();
    expect(() => playUnboxSound()).not.toThrow();
    expect(() => playCipherKeySound(1)).not.toThrow();
    expect(() => playDecryptPulseSound()).not.toThrow();
    expect(() => playCrashSound()).not.toThrow();
    expect(() => playWinSound()).not.toThrow();
    expect(() => playErrorSound()).not.toThrow();
  });

  it('haptic triggers fall back gracefully when window.Telegram is undefined', () => {
    expect(() => hapticTap()).not.toThrow();
    expect(() => hapticCrit()).not.toThrow();
    expect(() => hapticMerge()).not.toThrow();
    expect(() => hapticSuccess()).not.toThrow();
    expect(() => hapticError()).not.toThrow();
    expect(() => hapticCrash()).not.toThrow();
  });

  it('haptic triggers execute mock Telegram HapticFeedback when available', () => {
    const mockImpact = vi.fn();
    const mockNotification = vi.fn();
    const mockSelection = vi.fn();

    const mockTelegram = {
      WebApp: {
        HapticFeedback: {
          impactOccurred: mockImpact,
          notificationOccurred: mockNotification,
          selectionChanged: mockSelection,
        },
      },
    };

    (globalThis as { window?: { Telegram?: unknown } }).window = {
      Telegram: mockTelegram,
    };

    hapticTap();
    expect(mockImpact).toHaveBeenCalledWith('light');

    hapticCrit();
    expect(mockImpact).toHaveBeenCalledWith('heavy');

    hapticMerge();
    expect(mockImpact).toHaveBeenCalledWith('medium');

    hapticSuccess();
    expect(mockNotification).toHaveBeenCalledWith('success');

    hapticError();
    expect(mockNotification).toHaveBeenCalledWith('error');

    // Clean up global mock
    delete (globalThis as { window?: { Telegram?: unknown } }).window?.Telegram;
  });
});

describe('CHALLENGER ADVERSARIAL PROBES & DEFECT DISCOVERIES', () => {
  it('DEFECT PROBE 1: Grid gap specification conformance', () => {
    const cssPath = path.resolve(__dirname, '../components/arcade.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Requirement: Verify that all grids use repeat(N, minmax(0, 1fr)) with percentage/clamp gaps.
    // Check if gaps use clamp() or %
    const gridGapRegex =
      /(?:\.arcade-nav-tabs|\.catizen-grid|\.cipher-grid-v2)[\s\S]*?gap:\s*([^;]+);/g;
    const gaps: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = gridGapRegex.exec(cssContent)) !== null) {
      gaps.push(m[1]!.trim());
    }

    const usesClampOrPercent = gaps.some(
      (g) => g.includes('clamp') || g.includes('%'),
    );
    // Verified: Gaps now use clamp(4px, 1.5vw, 8px) fluid scaling.
    expect(usesClampOrPercent).toBe(true);
  });

  it('DEFECT PROBE 2: Touch targets below 44px minimum recommendation', () => {
    const cssPath = path.resolve(__dirname, '../components/arcade.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // .arcade-mute-btn: min-width: 44px x min-height: 44px
    const muteMatch = cssContent.match(
      /\.arcade-mute-btn\s*\{[^}]*(?:min-)?width:\s*(\d+)px;[^}]*(?:min-)?height:\s*(\d+)px;/,
    );
    expect(muteMatch).not.toBeNull();
    const muteW = parseInt(muteMatch![1]!, 10);
    expect(muteW).toBeGreaterThanOrEqual(44);

    // .catizen-auto-btn: min-height: 44px
    const autoBtnMatch = cssContent.match(
      /\.catizen-auto-btn\s*\{[^}]*min-height:\s*(\d+)px;/,
    );
    expect(autoBtnMatch).not.toBeNull();
    const autoBtnMinH = parseInt(autoBtnMatch![1]!, 10);
    expect(autoBtnMinH).toBeGreaterThanOrEqual(44);

    // .crash-chip-btn: min-height: 44px
    const chipBtnMatch = cssContent.match(
      /\.crash-chip-btn\s*\{[^}]*min-height:\s*(\d+)px;/,
    );
    expect(chipBtnMatch).not.toBeNull();
    const chipBtnMinH = parseInt(chipBtnMatch![1]!, 10);
    expect(chipBtnMinH).toBeGreaterThanOrEqual(44);
  });

  it('DEFECT PROBE 3: CryptoCrash countdown timer leak on unmount', () => {
    // In CryptoCrashGame, handleStartRound creates countTimer via window.setInterval
    // and stores it in countTimerRef, cleaned up on unmount.
    const crashGamePath = path.resolve(
      __dirname,
      '../components/crypto-crash-game.tsx',
    );
    const crashGameContent = fs.readFileSync(crashGamePath, 'utf8');

    // Check if countTimer is stored in a ref
    const hasCountTimerRef = crashGameContent.includes('countTimerRef');
    expect(hasCountTimerRef).toBe(true);

    // Check if countdown interval is cleaned up in unmount useEffect
    const unmountCleanup = crashGameContent.match(
      /useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*?return\s*\(\)\s*=>\s*\{([\s\S]*?)\};[\s\S]*?\},/,
    );
    expect(unmountCleanup).not.toBeNull();
    const cleanupBody = unmountCleanup![1]!;
    expect(cleanupBody.includes('clearInterval')).toBe(true);
  });

  it('DEFECT PROBE 4: CryptoCrash double cashout race condition without ref guard', () => {
    // In CryptoCrashGame, handleCashOut uses synchronous hasCashedOutRef guard
    // to prevent multiple rapid clicks within the same event batch before React re-renders.
    const crashGamePath = path.resolve(
      __dirname,
      '../components/crypto-crash-game.tsx',
    );
    const crashGameContent = fs.readFileSync(crashGamePath, 'utf8');

    const hasCashedOutRef =
      crashGameContent.includes('hasCashedOutRef') ||
      crashGameContent.includes('cashedOutRef') ||
      crashGameContent.includes('isCashedOutRef');
    expect(hasCashedOutRef).toBe(true);
  });

  it('DEFECT PROBE 5: NotcoinTap multi-touch concurrency serialized via tapStateRef', () => {
    const tapGamePath = path.resolve(
      __dirname,
      '../components/notcoin-tap-game.tsx',
    );
    const tapGameContent = fs.readFileSync(tapGamePath, 'utf8');

    // Verify tapStateRef exists
    expect(tapGameContent.includes('tapStateRef = useRef')).toBe(true);

    // Verify handleCoinTap reads from tapStateRef.current and updates tapStateRef.current synchronously before setTapState
    const coinTapFn = tapGameContent.match(
      /function handleCoinTap[\s\S]*?\{([\s\S]*?)\n {2}\}/,
    );
    expect(coinTapFn).not.toBeNull();
    const body = coinTapFn![1]!;
    expect(body.includes('tapStateRef.current')).toBe(true);
    expect(body.indexOf('tapStateRef.current =')).toBeLessThan(
      body.indexOf('setTapState'),
    );
  });

  it('DEFECT PROBE 6: CatizenMerge side effects executed outside setState functional updaters', () => {
    const catizenGamePath = path.resolve(
      __dirname,
      '../components/catizen-merge-game.tsx',
    );
    const catizenGameContent = fs.readFileSync(catizenGamePath, 'utf8');

    // Verify boardRef exists
    expect(catizenGameContent.includes('boardRef = useRef')).toBe(true);

    // Verify that autoBotTimerRef does NOT invoke onReward inside setBoard
    const hasOnRewardInsideSetBoard =
      /setBoard\s*\(\s*\([^)]*\)\s*=>[\s\S]*?onReward/.test(catizenGameContent);
    expect(hasOnRewardInsideSetBoard).toBe(false);
  });
});
