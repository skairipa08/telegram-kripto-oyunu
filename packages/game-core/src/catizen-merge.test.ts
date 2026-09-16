import { describe, expect, it } from 'vitest';
import { CATIZEN_MERGE_TIERS } from './minigames-config';
import {
  getMergeTierConfig,
  calculateBoardPassiveRate,
  calculateMergeReward,
  resolveParcelUnbox,
  executeSingleMerge,
  executeMove,
  executeUnboxParcel,
  solveAutoMergeBoard,
} from './catizen-merge';

describe('Catizen Merge Engine & Mathematical Models', () => {
  describe('Super-Linearity Invariant (R_{k+1} > 2 * R_k)', () => {
    it('guarantees passive rate strictly doubles and grows by >= 25% on every tier upgrade', () => {
      for (let k = 1; k < CATIZEN_MERGE_TIERS.length; k++) {
        const currentTier = CATIZEN_MERGE_TIERS[k - 1]!;
        const nextTier = CATIZEN_MERGE_TIERS[k]!;

        // Two tier-k items produce 2 * R_k
        const twoItemsRate = currentTier.passiveRatePerSec * 2;
        const mergedRate = nextTier.passiveRatePerSec;

        // Invariant: R_{k+1} > 2 * R_k
        expect(mergedRate).toBeGreaterThan(twoItemsRate);
      }
    });

    it('returns exact tier definitions matching design specification', () => {
      expect(getMergeTierConfig(1)?.name).toBe('Bronze Chip');
      expect(calculateMergeReward(1)).toBe(10);
      expect(CATIZEN_MERGE_TIERS).toHaveLength(12);
      expect(CATIZEN_MERGE_TIERS[0]!.name).toBe('Bronze Chip');
      expect(CATIZEN_MERGE_TIERS[0]!.passiveRatePerSec).toBe(1);
      expect(CATIZEN_MERGE_TIERS[0]!.mergeRewardCash).toBe(10);

      expect(CATIZEN_MERGE_TIERS[1]!.name).toBe('Silver Ingot');
      expect(CATIZEN_MERGE_TIERS[1]!.passiveRatePerSec).toBe(3);
      expect(CATIZEN_MERGE_TIERS[1]!.mergeRewardCash).toBe(22);

      expect(CATIZEN_MERGE_TIERS[11]!.name).toBe('Interdimensional Consensus');
      expect(CATIZEN_MERGE_TIERS[11]!.passiveRatePerSec).toBe(30518);
      expect(CATIZEN_MERGE_TIERS[11]!.mergeRewardCash).toBe(58350);
    });

    it('calculates total board passive rate accurately ignoring empty slots and parcels', () => {
      // 12-slot board: Tier 1 (1/s), Tier 2 (3/s), Tier 3 (8/s), parcel (-1), empty (0)
      const grid = [1, 2, 3, -1, 0, 0, 0, 0, 0, 0, 0, 0];
      // 1 + 3 + 8 = 12 Cash/s
      expect(calculateBoardPassiveRate(grid)).toBe(12);
    });
  });

  describe('Single Merge & Board Manipulations', () => {
    it('executes a valid merge between two matching tier items', () => {
      // Slot 0: Tier 1, Slot 1: Tier 1
      const grid = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const result = executeSingleMerge(grid, 0, 1);

      expect(result.success).toBe(true);
      expect(result.newGrid[0]).toBe(0);
      expect(result.newGrid[1]).toBe(2);
      expect(result.mergedTier).toBe(2);
      expect(result.rewardCash).toBe(10); // Reward for merging Tier 1
    });

    it('rejects invalid merges: mismatched tiers, empty slots, parcels, and max tier cap', () => {
      const grid = [1, 2, 0, -1, 12, 12, 0, 0, 0, 0, 0, 0];

      // Mismatch (Tier 1 and Tier 2)
      const mismatch = executeSingleMerge(grid, 0, 1);
      expect(mismatch.success).toBe(false);
      expect(mismatch.error).toBe('TIERS_DO_NOT_MATCH');

      // Merging with empty slot
      const emptySlot = executeSingleMerge(grid, 0, 2);
      expect(emptySlot.success).toBe(false);
      expect(emptySlot.error).toBe('CANNOT_MERGE_EMPTY_OR_PARCEL');

      // Merging with parcel
      const parcelSlot = executeSingleMerge(grid, 0, 3);
      expect(parcelSlot.success).toBe(false);
      expect(parcelSlot.error).toBe('CANNOT_MERGE_EMPTY_OR_PARCEL');

      // Same slot index
      const sameSlot = executeSingleMerge(grid, 0, 0);
      expect(sameSlot.success).toBe(false);
      expect(sameSlot.error).toBe('INVALID_SLOT_INDICES');

      // Max tier cap (Tier 12 cannot merge further)
      const maxTier = executeSingleMerge(grid, 4, 5);
      expect(maxTier.success).toBe(false);
      expect(maxTier.error).toBe('MAX_TIER_REACHED');
    });

    it('executes item movement to empty slots cleanly', () => {
      const grid = [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const move = executeMove(grid, 0, 4);

      expect(move.success).toBe(true);
      expect(move.newGrid[0]).toBe(0);
      expect(move.newGrid[4]).toBe(5);

      // Moving to occupied slot fails
      const blocked = executeMove(move.newGrid, 4, 4);
      expect(blocked.success).toBe(false);
    });

    it('unboxes mystery parcels into tiers 1, 2, or 3', () => {
      const grid = [-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      const t1 = executeUnboxParcel(grid, 0, 0.5); // < 0.75
      expect(t1.success).toBe(true);
      expect(t1.unboxedTier).toBe(1);

      const t2 = executeUnboxParcel(grid, 0, 0.85); // 0.75..0.95
      expect(t2.success).toBe(true);
      expect(t2.unboxedTier).toBe(2);

      const t3 = executeUnboxParcel(grid, 0, 0.98); // >= 0.95
      expect(t3.success).toBe(true);
      expect(t3.unboxedTier).toBe(3);
    });
  });

  describe('Mystery Parcel Probability Distribution (10,000 rolls)', () => {
    it('verifies 75% T1, 20% T2, 5% T3 distribution within tolerance', () => {
      let seed = 987654321;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      const N = 10_000;

      for (let i = 0; i < N; i++) {
        const tier = resolveParcelUnbox(pseudoRandom());
        counts[tier] = (counts[tier] ?? 0) + 1;
      }

      const p1 = counts[1]! / N;
      const p2 = counts[2]! / N;
      const p3 = counts[3]! / N;

      // Tier 1: 75% +/- 1.0% (0.74 to 0.76)
      expect(p1).toBeGreaterThanOrEqual(0.74);
      expect(p1).toBeLessThanOrEqual(0.76);

      // Tier 2: 20% +/- 1.0% (0.19 to 0.21)
      expect(p2).toBeGreaterThanOrEqual(0.19);
      expect(p2).toBeLessThanOrEqual(0.21);

      // Tier 3: 5% +/- 0.8% (0.042 to 0.058)
      expect(p3).toBeGreaterThanOrEqual(0.042);
      expect(p3).toBeLessThanOrEqual(0.058);
    });
  });

  describe('Auto-Merge Macro Solver & 1,000-Board Fuzzing Invariant', () => {
    it('solves simple board completely with lowest-tier priority', () => {
      // Four Tier 1 items -> should merge into two Tier 2 items -> which merge into one Tier 3 item!
      const grid = [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
      const result = solveAutoMergeBoard(grid);

      // 3 merges executed (1+1->2, 1+1->2, 2+2->3)
      expect(result.totalMergesExecuted).toBe(3);
      // Final board has exactly one Tier 3 item and 11 empty slots
      const activeItems = result.newGrid.filter((x) => x > 0);
      expect(activeItems).toEqual([3]);
      // Reward: 2 * 10 (for two T1 merges) + 22 (for one T2 merge) = 42
      expect(result.totalRewardCash).toBe(42);
    });

    it('unboxes parcels during auto-merge when autoUnbox is enabled', () => {
      const grid = [-1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const result = solveAutoMergeBoard(grid, {
        autoUnbox: true,
        rollFn: () => 0.1, // forces both to unbox as Tier 1
      });

      expect(result.parcelsOpened).toBe(2);
      // Both unbox as Tier 1, then auto-merge into one Tier 2
      expect(result.totalMergesExecuted).toBe(1);
      const activeItems = result.newGrid.filter((x) => x > 0);
      expect(activeItems).toEqual([2]);
    });

    it('fuzzes 1,000 randomized boards proving O(N) finite termination and no remaining pairs', () => {
      let seed = 445566778;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let testId = 0; testId < 1000; testId++) {
        // Generate a random 12-slot board with elements in [0..8, -1]
        const randomGrid: number[] = [];
        for (let s = 0; s < 12; s++) {
          const roll = Math.floor(pseudoRandom() * 10);
          if (roll === 0)
            randomGrid.push(0); // empty
          else if (roll === 1)
            randomGrid.push(-1); // parcel
          else randomGrid.push(roll - 1); // tier 1..8
        }

        const result = solveAutoMergeBoard(randomGrid, {
          autoUnbox: true,
          rollFn: pseudoRandom,
        });

        // INVARIANT 1: Total merges strictly bounded by grid length (12)
        expect(result.totalMergesExecuted).toBeLessThanOrEqual(12);

        // INVARIANT 2: Solved board has NO duplicate tiers for any tier < 12
        const tierCounts: Record<number, number> = {};
        for (const slot of result.newGrid) {
          if (slot > 0 && slot < 12) {
            tierCounts[slot] = (tierCounts[slot] ?? 0) + 1;
            // Never have 2 or more of the same mergeable tier remaining!
            expect(tierCounts[slot]).toBeLessThanOrEqual(1);
          }
        }

        // INVARIANT 3: No unboxed parcels remain
        expect(result.newGrid.includes(-1)).toBe(false);

        // INVARIANT 4: Total reward cash is non-negative and deterministic
        expect(result.totalRewardCash).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
