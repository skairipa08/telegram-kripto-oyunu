import { describe, expect, it } from 'vitest';
import {
  calculateMinesMultiplier,
  calculateNextMinesMultiplier,
  cashoutMinesGame,
  clickMinesTile,
  DEFAULT_MINES,
  DEFAULT_MINES_STAKE,
  generateMineLocations,
  MAX_MINES,
  MIN_MINES,
  MIN_MINES_STAKE,
  MINES_GRID_SIZE,
  MINES_HOUSE_EDGE,
  startMinesGame,
  type MinesGameState,
} from './crypto-mines-model';

describe('Crypto Mines Mathematical Model & Game Engine', () => {
  describe('calculateMinesMultiplier formula & representative values', () => {
    it('verifies 3% house edge formula: (1 - 0.03) * Product((25 - i) / (25 - m - i))', () => {
      // 3 mines, 1 gem: (25/22) * 0.97 = 1.10227... -> 1.10
      expect(calculateMinesMultiplier(1, 3)).toBe(1.1);

      // 3 mines, 2 gems: (25/22) * (24/21) * 0.97 = 1.2597... -> 1.26
      expect(calculateMinesMultiplier(2, 3)).toBe(1.26);

      // 5 mines, 1 gem: (25/20) * 0.97 = 1.2125 -> 1.21
      expect(calculateMinesMultiplier(1, 5)).toBe(1.21);

      // 10 mines, 1 gem: (25/15) * 0.97 = 1.6166... -> 1.62
      expect(calculateMinesMultiplier(1, 10)).toBe(1.62);

      // 20 mines, 1 gem: (25/5) * 0.97 = 4.85
      expect(calculateMinesMultiplier(1, 20)).toBe(4.85);

      // 20 mines, 5 gems (all safe tiles cleared):
      // (25/5 * 24/4 * 23/3 * 22/2 * 21/1) * 0.97 = 53130 * 0.97 = 51536.1
      expect(calculateMinesMultiplier(5, 20)).toBe(51536.1);
    });

    it('handles boundary conditions: revealedCount <= 0 returns 1.0', () => {
      expect(calculateMinesMultiplier(0, 3)).toBe(1.0);
      expect(calculateMinesMultiplier(-1, 3)).toBe(1.0);
      expect(calculateMinesMultiplier(-5, 10)).toBe(1.0);
    });

    it('handles boundary conditions: revealedCount > safeTiles returns 1.0', () => {
      // With 3 mines, there are 22 safe tiles. 23 gems is impossible
      expect(calculateMinesMultiplier(23, 3)).toBe(1.0);
      // With 20 mines, there are 5 safe tiles. 6 gems is impossible
      expect(calculateMinesMultiplier(6, 20)).toBe(1.0);
    });

    it('enforces minimum multiplier clamp of 1.01x', () => {
      // Even with high house edge or minimal risk, multiplier is never below 1.01
      const lowRiskMult = calculateMinesMultiplier(1, 1, 0.25);
      expect(lowRiskMult).toBeGreaterThanOrEqual(1.01);
    });

    it('supports custom house edge parameter', () => {
      // Zero house edge (fair): 3 mines, 1 gem -> 25/22 = 1.13636... -> 1.14
      expect(calculateMinesMultiplier(1, 3, 0.0)).toBe(1.14);

      // 5% house edge: 3 mines, 1 gem -> (25/22) * 0.95 = 1.0795... -> 1.08
      expect(calculateMinesMultiplier(1, 3, 0.05)).toBe(1.08);
    });
  });

  describe('calculateNextMinesMultiplier', () => {
    it('returns the multiplier for the subsequent gem count', () => {
      expect(calculateNextMinesMultiplier(0, 3)).toBe(
        calculateMinesMultiplier(1, 3),
      );
      expect(calculateNextMinesMultiplier(1, 3)).toBe(
        calculateMinesMultiplier(2, 3),
      );
      expect(calculateNextMinesMultiplier(4, 20)).toBe(
        calculateMinesMultiplier(5, 20),
      );
    });
  });

  describe('generateMineLocations Fisher-Yates generator', () => {
    it('generates exact count of mines strictly within grid bounds [0..24]', () => {
      const standardMineCounts = [1, 3, 5, 10, 15, 20];
      for (const m of standardMineCounts) {
        const locations = generateMineLocations(m);
        expect(locations).toHaveLength(m);
        for (const idx of locations) {
          expect(Number.isInteger(idx)).toBe(true);
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(MINES_GRID_SIZE);
        }
      }
    });

    it('guarantees unique, non-repeating indices', () => {
      for (let m = 1; m <= 24; m++) {
        const locations = generateMineLocations(m);
        expect(locations).toHaveLength(m);
        const uniqueSet = new Set(locations);
        expect(uniqueSet.size).toBe(m);
      }
    });

    it('strictly respects excludeIndex (first-click safe protection)', () => {
      const excludeIndicesToTest = [0, 4, 12, 17, 24];
      for (const exclude of excludeIndicesToTest) {
        // Even with 24 mines (where only 1 tile is safe), the excluded tile is NEVER a mine
        const locations = generateMineLocations(24, exclude);
        expect(locations).toHaveLength(24);
        expect(locations).not.toContain(exclude);
      }
    });

    it('handles negative or out-of-range excludeIndex gracefully', () => {
      const locationsNegative = generateMineLocations(5, -1);
      expect(locationsNegative).toHaveLength(5);

      const locationsOutOfRange = generateMineLocations(5, 99);
      expect(locationsOutOfRange).toHaveLength(5);
    });

    it('produces randomized distribution over multiple iterations', () => {
      const frequency = new Array(MINES_GRID_SIZE).fill(0);
      const iterations = 500;
      for (let i = 0; i < iterations; i++) {
        const locations = generateMineLocations(5);
        for (const loc of locations) {
          frequency[loc]++;
        }
      }

      // Every tile should be chosen at least once across 500 iterations of 5 mines
      for (let i = 0; i < MINES_GRID_SIZE; i++) {
        expect(frequency[i]).toBeGreaterThan(0);
      }
    });
  });

  describe('startMinesGame lifecycle & initialization', () => {
    it('initializes a fresh game with playing status, empty revealed tiles, and 1.0 multiplier', () => {
      const state = startMinesGame(100, 3);
      expect(state.status).toBe('playing');
      expect(state.stake).toBe(100);
      expect(state.mineCount).toBe(3);
      expect(state.mineLocations).toHaveLength(3);
      expect(state.revealedTiles).toEqual([]);
      expect(state.currentMultiplier).toBe(1.0);
      expect(state.nextMultiplier).toBe(calculateMinesMultiplier(1, 3));
      expect(state.payoutCash).toBe(0);
      expect(typeof state.startTime).toBe('number');
    });

    it('clamps stake to MIN_MINES_STAKE (10)', () => {
      const lowStakeState = startMinesGame(2, 3);
      expect(lowStakeState.stake).toBe(MIN_MINES_STAKE);
    });

    it('clamps mineCount between MIN_MINES (1) and MAX_MINES (24)', () => {
      const minClamped = startMinesGame(100, 0);
      expect(minClamped.mineCount).toBe(MIN_MINES);
      expect(minClamped.mineLocations).toHaveLength(MIN_MINES);

      const maxClamped = startMinesGame(100, 50);
      expect(maxClamped.mineCount).toBe(MAX_MINES);
      expect(maxClamped.mineLocations).toHaveLength(MAX_MINES);
    });
  });

  describe('clickMinesTile gameplay transitions', () => {
    it('reveals safe gem: updates multiplier, revealed tiles, and potential payout', () => {
      const state = startMinesGame(500, 3);
      // Find a tile that is not a mine
      const safeIndex = Array.from(
        { length: MINES_GRID_SIZE },
        (_, i) => i,
      ).find((i) => !state.mineLocations.includes(i))!;

      const result = clickMinesTile(state, safeIndex);
      expect(result.hitMine).toBe(false);
      expect(result.gemsRevealed).toBe(1);
      expect(result.nextState.status).toBe('playing');
      expect(result.nextState.revealedTiles).toEqual([safeIndex]);
      expect(result.nextState.currentMultiplier).toBe(1.1);
      expect(result.nextState.payoutCash).toBe(Math.floor(500 * 1.1)); // 550
      expect(result.nextState.nextMultiplier).toBe(1.26);
    });

    it('sequential safe reveals compound multipliers accurately', () => {
      const state = startMinesGame(1000, 5);
      const safeIndices = Array.from(
        { length: MINES_GRID_SIZE },
        (_, i) => i,
      ).filter((i) => !state.mineLocations.includes(i));

      // First gem
      const step1 = clickMinesTile(state, safeIndices[0]!);
      expect(step1.hitMine).toBe(false);
      expect(step1.gemsRevealed).toBe(1);
      expect(step1.nextState.currentMultiplier).toBe(1.21);
      expect(step1.nextState.payoutCash).toBe(1210);

      // Second gem
      const step2 = clickMinesTile(step1.nextState, safeIndices[1]!);
      expect(step2.hitMine).toBe(false);
      expect(step2.gemsRevealed).toBe(2);
      expect(step2.nextState.currentMultiplier).toBe(
        calculateMinesMultiplier(2, 5),
      );
      expect(step2.nextState.payoutCash).toBe(
        Math.floor(1000 * calculateMinesMultiplier(2, 5)),
      );
    });

    it('hitting a mine: sets status to busted, currentMultiplier to 0, payout to 0', () => {
      const state = startMinesGame(500, 3);
      const mineIndex = state.mineLocations[0]!;

      const result = clickMinesTile(state, mineIndex);
      expect(result.hitMine).toBe(true);
      expect(result.nextState.status).toBe('busted');
      expect(result.nextState.revealedTiles).toContain(mineIndex);
      expect(result.nextState.currentMultiplier).toBe(0);
      expect(result.nextState.nextMultiplier).toBe(0);
      expect(result.nextState.payoutCash).toBe(0);
    });

    it('ignores clicks on already revealed tiles without mutating state', () => {
      const state = startMinesGame(100, 3);
      const safeIndex = Array.from(
        { length: MINES_GRID_SIZE },
        (_, i) => i,
      ).find((i) => !state.mineLocations.includes(i))!;

      const firstClick = clickMinesTile(state, safeIndex);
      const duplicateClick = clickMinesTile(firstClick.nextState, safeIndex);

      expect(duplicateClick.hitMine).toBe(false);
      expect(duplicateClick.nextState).toBe(firstClick.nextState);
    });

    it('ignores clicks if game is not in playing status', () => {
      const bustedState: MinesGameState = {
        status: 'busted',
        stake: 100,
        mineCount: 3,
        mineLocations: [0, 1, 2],
        revealedTiles: [0],
        currentMultiplier: 0,
        nextMultiplier: 0,
        payoutCash: 0,
        startTime: Date.now(),
      };

      const result = clickMinesTile(bustedState, 5);
      expect(result.nextState).toBe(bustedState);
      expect(result.hitMine).toBe(false);
    });

    it('automatically cashes out when all safe tiles are revealed (board clear)', () => {
      // 24 mines leaves exactly 1 safe tile
      const customLocations = Array.from({ length: 24 }, (_, i) => i); // 0..23 are mines, 24 is safe
      const state: MinesGameState = {
        status: 'playing',
        stake: 100,
        mineCount: 24,
        mineLocations: customLocations,
        revealedTiles: [],
        currentMultiplier: 1.0,
        nextMultiplier: calculateMinesMultiplier(1, 24),
        payoutCash: 0,
        startTime: Date.now(),
      };

      const result = clickMinesTile(state, 24);
      expect(result.hitMine).toBe(false);
      expect(result.nextState.status).toBe('cashed_out');
      expect(result.nextState.revealedTiles).toEqual([24]);
      expect(result.nextState.payoutCash).toBe(
        Math.floor(100 * calculateMinesMultiplier(1, 24)),
      );
    });
  });

  describe('cashoutMinesGame', () => {
    it('cashes out active game with revealed gems and calculates net profit', () => {
      const state = startMinesGame(500, 3);
      const safeIndex = Array.from(
        { length: MINES_GRID_SIZE },
        (_, i) => i,
      ).find((i) => !state.mineLocations.includes(i))!;

      const afterOneGem = clickMinesTile(state, safeIndex).nextState;
      const cashout = cashoutMinesGame(afterOneGem);

      expect(cashout.nextState.status).toBe('cashed_out');
      expect(cashout.payoutCash).toBe(550); // Math.floor(500 * 1.10)
      expect(cashout.netProfit).toBe(50); // 550 - 500
      expect(cashout.nextState.payoutCash).toBe(550);
    });

    it('returns 0 payout and netProfit if cashout attempted with 0 revealed tiles', () => {
      const state = startMinesGame(500, 3);
      const cashout = cashoutMinesGame(state);

      expect(cashout.payoutCash).toBe(0);
      expect(cashout.netProfit).toBe(0);
      expect(cashout.nextState.status).toBe('playing');
    });

    it('returns 0 payout and netProfit if game status is not playing', () => {
      const cashedOutState: MinesGameState = {
        status: 'cashed_out',
        stake: 500,
        mineCount: 3,
        mineLocations: [0, 1, 2],
        revealedTiles: [3],
        currentMultiplier: 1.1,
        nextMultiplier: 1.26,
        payoutCash: 550,
        startTime: Date.now(),
      };

      const cashout = cashoutMinesGame(cashedOutState);
      expect(cashout.payoutCash).toBe(0);
      expect(cashout.netProfit).toBe(0);
      expect(cashout.nextState).toBe(cashedOutState);
    });
  });

  describe('constants export verification', () => {
    it('verifies game configuration constants', () => {
      expect(MINES_GRID_SIZE).toBe(25);
      expect(MIN_MINES).toBe(1);
      expect(MAX_MINES).toBe(24);
      expect(DEFAULT_MINES).toBe(3);
      expect(DEFAULT_MINES_STAKE).toBe(100);
      expect(MIN_MINES_STAKE).toBe(10);
      expect(MINES_HOUSE_EDGE).toBe(0.03);
    });
  });
});
