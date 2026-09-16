import { describe, expect, it } from 'vitest';
import {
  calculateBoardDps,
  calculateIdleEarnings,
  canMergeSlots,
  createInitialBoard,
  executeMerge,
  findAutoMergeCandidate,
  findFirstParcel,
  getTierDefinition,
  MAX_MERGE_TIER,
  MERGE_TIERS,
  moveOrSwapSlot,
  openParcel,
  spawnParcel,
  type MergeSlot,
} from './catizen-merge-model';

describe('Catizen Merge Model', () => {
  it('defines at least 10 progressive tiers with strictly ascending DPS and merge rewards', () => {
    expect(MERGE_TIERS.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < MERGE_TIERS.length; i++) {
      expect(MERGE_TIERS[i]!.dps).toBeGreaterThan(MERGE_TIERS[i - 1]!.dps);
      expect(MERGE_TIERS[i]!.mergeReward).toBeGreaterThan(
        MERGE_TIERS[i - 1]!.mergeReward,
      );
    }
  });

  it('provides safe fallback for tiers beyond the table', () => {
    const beyond = getTierDefinition(99);
    expect(beyond.tier).toBe(99);
    expect(beyond.dps).toBeGreaterThan(0);
    expect(beyond.mergeReward).toBeGreaterThan(0);
  });

  it('creates an initial board with 12 slots and starter items', () => {
    const board = createInitialBoard();
    expect(board).toHaveLength(12);
    expect(board[0]?.type).toBe('item');
    expect((board[0] as { tier: number }).tier).toBe(1);
    expect(board[1]?.type).toBe('item');
    expect((board[1] as { tier: number }).tier).toBe(1);
    expect(board[2]?.type).toBe('item');
    expect((board[2] as { tier: number }).tier).toBe(2);
    expect(board[3]).toBeNull();
  });

  it('correctly validates whether two slots can merge', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: 1, id: '1' };
    board[1] = { type: 'item', tier: 1, id: '2' };
    board[2] = { type: 'item', tier: 2, id: '3' };
    board[3] = { type: 'parcel', id: 'p', spawnTime: 100 };

    expect(canMergeSlots(board, 0, 1)).toBe(true);
    expect(canMergeSlots(board, 0, 2)).toBe(false); // different tiers
    expect(canMergeSlots(board, 0, 3)).toBe(false); // parcel
    expect(canMergeSlots(board, 0, 4)).toBe(false); // empty slot
    expect(canMergeSlots(board, 0, 0)).toBe(false); // same slot
    expect(canMergeSlots(board, -1, 1)).toBe(false); // out of bounds
  });

  it('executes merge cleanly, creating next tier and clearing source slot', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: 3, id: 'a' };
    board[1] = { type: 'item', tier: 3, id: 'b' };

    const result = executeMerge(board, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.newTier).toBe(4);
    expect(result!.reward).toBe(getTierDefinition(4).mergeReward);
    expect(result!.board[0]).toBeNull();
    expect(result!.board[1]?.type).toBe('item');
    expect((result!.board[1] as { tier: number }).tier).toBe(4);
  });

  it('rejects merging when slot has max tier', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: MAX_MERGE_TIER, id: 'max1' };
    board[1] = { type: 'item', tier: MAX_MERGE_TIER, id: 'max2' };

    expect(canMergeSlots(board, 0, 1)).toBe(false);
    expect(executeMerge(board, 0, 1)).toBeNull();
  });

  it('handles moving to empty slot, merging to matching slot, and swapping with different slot', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: 1, id: 'item-1' };
    board[2] = { type: 'item', tier: 2, id: 'item-2' };
    board[3] = { type: 'item', tier: 1, id: 'item-3' };

    // Move to empty
    const moveRes = moveOrSwapSlot(board, 0, 1);
    expect(moveRes).not.toBeNull();
    expect(moveRes!.merged).toBe(false);
    expect(moveRes!.board[0]).toBeNull();
    expect(moveRes!.board[1]?.type).toBe('item');

    // Merge matching
    const mergeRes = moveOrSwapSlot(board, 0, 3);
    expect(mergeRes).not.toBeNull();
    expect(mergeRes!.merged).toBe(true);
    expect(mergeRes!.newTier).toBe(2);
    expect(mergeRes!.board[0]).toBeNull();
    expect((mergeRes!.board[3] as { tier: number }).tier).toBe(2);

    // Swap non-matching
    const swapRes = moveOrSwapSlot(board, 0, 2);
    expect(swapRes).not.toBeNull();
    expect(swapRes!.merged).toBe(false);
    expect((swapRes!.board[0] as { tier: number }).tier).toBe(2);
    expect((swapRes!.board[2] as { tier: number }).tier).toBe(1);
  });

  it('spawns mystery parcels in empty slots and handles board overflow', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    const spawned = spawnParcel(board, 5);
    expect(spawned).not.toBeNull();
    expect(spawned!.index).toBe(5);
    expect(spawned!.board[5]?.type).toBe('parcel');

    // Full board cannot spawn
    const fullBoard: MergeSlot[] = Array(12).fill({
      type: 'item',
      tier: 1,
      id: 'x',
    });
    expect(spawnParcel(fullBoard)).toBeNull();
  });

  it('opens mystery parcels into tier 1 or tier 2 items', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[4] = { type: 'parcel', id: 'box-1', spawnTime: Date.now() };

    const opened = openParcel(board, 4, 2);
    expect(opened).not.toBeNull();
    expect(opened!.tier).toBe(2);
    expect(opened!.board[4]?.type).toBe('item');
    expect((opened!.board[4] as { tier: number }).tier).toBe(2);

    // Non-parcel returns null
    expect(openParcel(board, 0)).toBeNull();
  });

  it('calculates total board DPS and idle accumulated earnings accurately', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: 1, id: 'a' }; // 1 dps
    board[1] = { type: 'item', tier: 2, id: 'b' }; // 3 dps
    board[2] = { type: 'item', tier: 3, id: 'c' }; // 8 dps
    board[3] = { type: 'parcel', id: 'p', spawnTime: 1 }; // 0 dps

    const totalDps = calculateBoardDps(board);
    expect(totalDps).toBe(1 + 3 + 8);

    const earned = calculateIdleEarnings(totalDps, 10);
    expect(earned).toBe(120);

    expect(calculateIdleEarnings(totalDps, -5)).toBe(0);
    expect(calculateIdleEarnings(0, 10)).toBe(0);
  });

  it('finds lowest-tier auto merge pair correctly without deadlock', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[1] = { type: 'item', tier: 4, id: 'p4-1' };
    board[3] = { type: 'item', tier: 4, id: 'p4-2' };
    board[5] = { type: 'item', tier: 2, id: 'p2-1' };
    board[8] = { type: 'item', tier: 2, id: 'p2-2' };

    // Should prioritize tier 2 over tier 4
    const pair = findAutoMergeCandidate(board);
    expect(pair).not.toBeNull();
    expect(pair).toEqual([5, 8]);

    // When no matches exist
    const noMatchBoard: MergeSlot[] = Array(12).fill(null);
    noMatchBoard[0] = { type: 'item', tier: 1, id: '1' };
    noMatchBoard[1] = { type: 'item', tier: 2, id: '2' };
    noMatchBoard[2] = { type: 'item', tier: 3, id: '3' };
    expect(findAutoMergeCandidate(noMatchBoard)).toBeNull();
  });

  it('identifies the first parcel slot for auto-bot assist', () => {
    const board: MergeSlot[] = Array(12).fill(null);
    board[0] = { type: 'item', tier: 1, id: '1' };
    board[6] = { type: 'parcel', id: 'p1', spawnTime: 1 };
    board[9] = { type: 'parcel', id: 'p2', spawnTime: 2 };

    expect(findFirstParcel(board)).toBe(6);

    const emptyBoard = Array(12).fill(null);
    expect(findFirstParcel(emptyBoard)).toBeNull();
  });
});
