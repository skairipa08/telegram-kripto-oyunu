// apps/web/src/game/crypto-mines-model.ts
// Mathematical model and engine for Crypto Mines gambling game

export const MINES_GRID_SIZE = 25; // 5x5 grid
export const MIN_MINES = 1;
export const MAX_MINES = 24;
export const DEFAULT_MINES = 3;
export const DEFAULT_MINES_STAKE = 100;
export const MIN_MINES_STAKE = 10;
export const MINES_HOUSE_EDGE = 0.03; // 3% house edge (97% RTP)

export type TileState = 'hidden' | 'gem' | 'mine';

export interface MinesGameState {
  status: 'idle' | 'playing' | 'cashed_out' | 'busted';
  stake: number;
  mineCount: number;
  mineLocations: number[]; // indices 0..24
  revealedTiles: number[]; // indices revealed so far
  currentMultiplier: number;
  nextMultiplier: number;
  payoutCash: number;
  startTime: number;
}

/**
 * Calculates the exact cumulative multiplier for revealing `revealedCount` gems
 * with `mineCount` mines on a 25-tile grid.
 * Formula: (1 - houseEdge) * Product_{i=0..k-1} ( (25 - i) / (25 - mineCount - i) )
 */
export function calculateMinesMultiplier(
  revealedCount: number,
  mineCount: number,
  houseEdge = MINES_HOUSE_EDGE,
): number {
  if (revealedCount <= 0) return 1.0;
  const safeTiles = MINES_GRID_SIZE - mineCount;
  if (revealedCount > safeTiles) return 1.0;

  let multiplier = 1.0;
  for (let i = 0; i < revealedCount; i++) {
    multiplier *= (MINES_GRID_SIZE - i) / (safeTiles - i);
  }

  const rtpMultiplier = multiplier * (1 - houseEdge);
  // Round to 2 decimal places, minimum 1.01x
  return Math.max(1.01, Math.round(rtpMultiplier * 100) / 100);
}

/**
 * Calculates the multiplier if the player reveals one more safe tile.
 */
export function calculateNextMinesMultiplier(
  revealedCount: number,
  mineCount: number,
  houseEdge = MINES_HOUSE_EDGE,
): number {
  return calculateMinesMultiplier(revealedCount + 1, mineCount, houseEdge);
}

/**
 * Generates randomized mine locations for a 25-tile board.
 */
export function generateMineLocations(
  mineCount: number,
  excludeIndex?: number,
): number[] {
  const safeExclude =
    typeof excludeIndex === 'number' &&
    excludeIndex >= 0 &&
    excludeIndex < MINES_GRID_SIZE
      ? excludeIndex
      : -1;

  const available: number[] = [];
  for (let i = 0; i < MINES_GRID_SIZE; i++) {
    if (i !== safeExclude) {
      available.push(i);
    }
  }

  // Fisher-Yates shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = available[i]!;
    available[i] = available[j]!;
    available[j] = tmp;
  }

  return available.slice(0, Math.min(mineCount, available.length));
}

/**
 * Initializes a new Mines game round.
 */
export function startMinesGame(
  stake: number,
  mineCount: number,
): MinesGameState {
  const clampedStake = Math.max(MIN_MINES_STAKE, stake);
  const clampedMines = Math.min(MAX_MINES, Math.max(MIN_MINES, mineCount));

  // Pre-generate mines
  const mines = generateMineLocations(clampedMines);

  return {
    status: 'playing',
    stake: clampedStake,
    mineCount: clampedMines,
    mineLocations: mines,
    revealedTiles: [],
    currentMultiplier: 1.0,
    nextMultiplier: calculateNextMinesMultiplier(0, clampedMines),
    payoutCash: 0,
    startTime: Date.now(),
  };
}

/**
 * Handles clicking a tile on the board.
 */
export function clickMinesTile(
  state: MinesGameState,
  tileIndex: number,
): {
  nextState: MinesGameState;
  hitMine: boolean;
  gemsRevealed: number;
} {
  if (state.status !== 'playing') {
    return {
      nextState: state,
      hitMine: false,
      gemsRevealed: state.revealedTiles.length,
    };
  }

  if (state.revealedTiles.includes(tileIndex)) {
    return {
      nextState: state,
      hitMine: false,
      gemsRevealed: state.revealedTiles.length,
    };
  }

  const isMine = state.mineLocations.includes(tileIndex);

  if (isMine) {
    // Boom! Game over
    return {
      nextState: {
        ...state,
        status: 'busted',
        revealedTiles: [...state.revealedTiles, tileIndex],
        currentMultiplier: 0,
        nextMultiplier: 0,
        payoutCash: 0,
      },
      hitMine: true,
      gemsRevealed: state.revealedTiles.length,
    };
  }

  // Safe gem uncovered!
  const newRevealed = [...state.revealedTiles, tileIndex];
  const newMult = calculateMinesMultiplier(newRevealed.length, state.mineCount);
  const maxSafeTiles = MINES_GRID_SIZE - state.mineCount;
  const isBoardCleared = newRevealed.length === maxSafeTiles;

  const nextMult = isBoardCleared
    ? newMult
    : calculateNextMinesMultiplier(newRevealed.length, state.mineCount);

  const payout = Math.floor(state.stake * newMult);

  return {
    nextState: {
      ...state,
      status: isBoardCleared ? 'cashed_out' : 'playing',
      revealedTiles: newRevealed,
      currentMultiplier: newMult,
      nextMultiplier: nextMult,
      payoutCash: payout,
    },
    hitMine: false,
    gemsRevealed: newRevealed.length,
  };
}

/**
 * Cash out current multiplier winnings.
 */
export function cashoutMinesGame(state: MinesGameState): {
  nextState: MinesGameState;
  payoutCash: number;
  netProfit: number;
} {
  if (state.status !== 'playing' || state.revealedTiles.length === 0) {
    return { nextState: state, payoutCash: 0, netProfit: 0 };
  }

  const mult = calculateMinesMultiplier(
    state.revealedTiles.length,
    state.mineCount,
  );
  const payout = Math.floor(state.stake * mult);
  const netProfit = payout - state.stake;

  return {
    nextState: {
      ...state,
      status: 'cashed_out',
      currentMultiplier: mult,
      payoutCash: payout,
    },
    payoutCash: payout,
    netProfit,
  };
}
