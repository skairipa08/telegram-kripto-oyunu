/**
 * Catizen-Style Item Merge Engine
 *
 * Mathematical models for:
 * - 12-tier collectible emblem progression
 * - Super-linear passive rate scaling (R_{k+1} > 2 * R_k)
 * - Mystery parcel drops and unbox probability distributions
 * - Board passive rate calculation
 * - O(N) Auto-Merge macro solver with provable finite termination
 */

import {
  type CatizenMergeConfig,
  type CatizenMergeTier,
  DEFAULT_CATIZEN_CONFIG,
} from './minigames-config';

/**
 * Retrieves the tier configuration for a given tier (1..100).
 * Tiers 1-12 use hand-crafted definitions; higher tiers up to 100 are dynamically computed.
 */
export function getMergeTierConfig(
  tier: number,
  config: CatizenMergeConfig = DEFAULT_CATIZEN_CONFIG,
): CatizenMergeTier | undefined {
  if (tier < 1 || tier > 100) return undefined;
  const staticTier = config.tiers.find((t) => t.tier === tier);
  if (staticTier) return staticTier;

  // Dynamically compute higher tiers up to 100
  const baseRate = 1;
  const passiveRatePerSec = Math.round(baseRate * Math.pow(2.2, tier - 1));
  const mergeRewardCash = Math.round(10 * Math.pow(2.0, tier - 1));

  return {
    tier,
    name: `Tier ${tier} Artifact`,
    nameTr: `Seviye ${tier} Kasa`,
    passiveRatePerSec,
    mergeRewardCash,
  };
}

/**
 * Calculates the cash fee required to perform a merge for tier `tier`.
 * Creates an economic governor preventing free instant scaling to tier 100.
 */
export function calculateMergeCost(tier: number): number {
  if (tier < 1) return 0;
  return Math.round(5 * Math.pow(1.5, tier - 1));
}

/**
 * Calculates the assembly cooldown time in seconds for tier `tier`.
 */
export function calculateMergeCooldownSeconds(tier: number): number {
  return Math.min(30, Math.max(1, Math.round(1 + Math.log2(tier) * 2)));
}

/**
 * Calculates total passive cash generation per second from the current board.
 * Empty slots (0) and parcels (-1) generate 0 cash/s.
 */
export function calculateBoardPassiveRate(
  grid: readonly number[],
  config: CatizenMergeConfig = DEFAULT_CATIZEN_CONFIG,
): number {
  let totalRate = 0;
  for (const item of grid) {
    if (item > 0) {
      const tierConfig = getMergeTierConfig(item, config);
      if (tierConfig) {
        totalRate += tierConfig.passiveRatePerSec;
      }
    }
  }
  return totalRate;
}

/**
 * Calculates the one-time merge reward when merging two Tier `fromTier` items into Tier `fromTier + 1`.
 */
export function calculateMergeReward(
  fromTier: number,
  config: CatizenMergeConfig = DEFAULT_CATIZEN_CONFIG,
): number {
  const tierConfig = getMergeTierConfig(fromTier, config);
  return tierConfig ? tierConfig.mergeRewardCash : 0;
}

/**
 * Resolves mystery parcel unboxing according to probability distribution:
 * - Tier 1: 75% [0.00, 0.75)
 * - Tier 2: 20% [0.75, 0.95)
 * - Tier 3: 5%  [0.95, 1.00)
 */
export function resolveParcelUnbox(
  roll?: number,
  config: CatizenMergeConfig = DEFAULT_CATIZEN_CONFIG,
): number {
  const r = roll !== undefined ? roll : Math.random();
  const c1 = config.parcelChances.tier1;
  const c2 = c1 + config.parcelChances.tier2;

  if (r < c1) {
    return 1;
  }
  if (r < c2) {
    return 2;
  }
  return 3;
}

export interface SingleMergeResult {
  success: boolean;
  newGrid: number[];
  mergedTier?: number;
  rewardCash: number;
  error?: string;
}

/**
 * Executes a single manual merge between two slots on the board.
 * Validates slot bounds, matching tiers, and maximum tier cap.
 */
export function executeSingleMerge(
  grid: readonly number[],
  sourceIndex: number,
  targetIndex: number,
  config: CatizenMergeConfig = DEFAULT_CATIZEN_CONFIG,
): SingleMergeResult {
  if (
    sourceIndex < 0 ||
    sourceIndex >= grid.length ||
    targetIndex < 0 ||
    targetIndex >= grid.length ||
    sourceIndex === targetIndex
  ) {
    return {
      success: false,
      newGrid: [...grid],
      rewardCash: 0,
      error: 'INVALID_SLOT_INDICES',
    };
  }

  const sourceItem = grid[sourceIndex];
  const targetItem = grid[targetIndex];

  if (!sourceItem || !targetItem || sourceItem <= 0 || targetItem <= 0) {
    return {
      success: false,
      newGrid: [...grid],
      rewardCash: 0,
      error: 'CANNOT_MERGE_EMPTY_OR_PARCEL',
    };
  }

  if (sourceItem !== targetItem) {
    return {
      success: false,
      newGrid: [...grid],
      rewardCash: 0,
      error: 'TIERS_DO_NOT_MATCH',
    };
  }

  if (sourceItem >= config.tiers.length) {
    return {
      success: false,
      newGrid: [...grid],
      rewardCash: 0,
      error: 'MAX_TIER_REACHED',
    };
  }

  const newGrid = [...grid];
  const newTier = sourceItem + 1;
  newGrid[sourceIndex] = 0;
  newGrid[targetIndex] = newTier;
  const rewardCash = calculateMergeReward(sourceItem, config);

  return {
    success: true,
    newGrid,
    mergedTier: newTier,
    rewardCash,
  };
}

/**
 * Moves an item to an empty slot.
 */
export function executeMove(
  grid: readonly number[],
  sourceIndex: number,
  targetIndex: number,
): { success: boolean; newGrid: number[]; error?: string } {
  if (
    sourceIndex < 0 ||
    sourceIndex >= grid.length ||
    targetIndex < 0 ||
    targetIndex >= grid.length ||
    sourceIndex === targetIndex
  ) {
    return {
      success: false,
      newGrid: [...grid],
      error: 'INVALID_SLOT_INDICES',
    };
  }

  const sourceItem = grid[sourceIndex];
  const targetItem = grid[targetIndex];

  if (sourceItem === undefined || sourceItem === 0) {
    return { success: false, newGrid: [...grid], error: 'SOURCE_EMPTY' };
  }
  if (targetItem !== 0) {
    return { success: false, newGrid: [...grid], error: 'TARGET_OCCUPIED' };
  }

  const newGrid = [...grid];
  newGrid[sourceIndex] = 0;
  newGrid[targetIndex] = sourceItem;

  return { success: true, newGrid };
}

/**
 * Unboxes a parcel (-1) at the given slot index.
 */
export function executeUnboxParcel(
  grid: readonly number[],
  slotIndex: number,
  roll?: number,
  config: CatizenMergeConfig = DEFAULT_CATIZEN_CONFIG,
): {
  success: boolean;
  newGrid: number[];
  unboxedTier?: number;
  error?: string;
} {
  if (slotIndex < 0 || slotIndex >= grid.length) {
    return { success: false, newGrid: [...grid], error: 'INVALID_SLOT_INDEX' };
  }
  if (grid[slotIndex] !== -1) {
    return { success: false, newGrid: [...grid], error: 'SLOT_NOT_A_PARCEL' };
  }

  const newGrid = [...grid];
  const unboxedTier = resolveParcelUnbox(roll, config);
  newGrid[slotIndex] = unboxedTier;

  return { success: true, newGrid, unboxedTier };
}

export interface AutoMergeResult {
  newGrid: number[];
  totalMergesExecuted: number;
  parcelsOpened: number;
  totalRewardCash: number;
  newPassiveRatePerSecond: number;
}

/**
 * Solves and executes all possible merges on the board automatically.
 * Guarantees O(N) termination: each merge strictly decreases the count of occupied slots by 1.
 * Priority: lowest tiers merged first to maximize space and progression.
 */
export function solveAutoMergeBoard(
  grid: readonly number[],
  options: {
    autoUnbox?: boolean;
    config?: CatizenMergeConfig;
    rollFn?: () => number;
  } = {},
): AutoMergeResult {
  const config = options.config ?? DEFAULT_CATIZEN_CONFIG;
  const newGrid = [...grid];
  let parcelsOpened = 0;
  let totalRewardCash = 0;
  let totalMergesExecuted = 0;

  // Step 1: Optionally unbox all parcels
  if (options.autoUnbox) {
    for (let i = 0; i < newGrid.length; i++) {
      if (newGrid[i] === -1) {
        const unboxedTier = resolveParcelUnbox(
          options.rollFn ? options.rollFn() : undefined,
          config,
        );
        newGrid[i] = unboxedTier;
        parcelsOpened++;
      }
    }
  }

  // Step 2: Iteratively find lowest matching pair and merge
  // Since each merge decreases total non-zero elements by 1, max iterations <= newGrid.length
  const maxIterations = newGrid.length + 5;
  let iterations = 0;

  while (iterations++ < maxIterations) {
    let bestTier = Infinity;
    let firstIdx = -1;
    let secondIdx = -1;

    // Scan for lowest tier having >= 2 slots
    for (let tier = 1; tier < config.tiers.length; tier++) {
      const indices: number[] = [];
      for (let i = 0; i < newGrid.length; i++) {
        if (newGrid[i] === tier) {
          indices.push(i);
          if (indices.length === 2) {
            break;
          }
        }
      }

      if (indices.length >= 2) {
        bestTier = tier;
        firstIdx = indices[0]!;
        secondIdx = indices[1]!;
        break; // Lowest tier found
      }
    }

    if (bestTier === Infinity || firstIdx === -1 || secondIdx === -1) {
      break; // No more merges possible
    }

    // Execute merge: first slot cleared (0), second slot promoted (tier + 1)
    newGrid[firstIdx] = 0;
    newGrid[secondIdx] = bestTier + 1;
    totalRewardCash += calculateMergeReward(bestTier, config);
    totalMergesExecuted++;
  }

  const newPassiveRatePerSecond = calculateBoardPassiveRate(newGrid, config);

  return {
    newGrid,
    totalMergesExecuted,
    parcelsOpened,
    totalRewardCash,
    newPassiveRatePerSecond,
  };
}
