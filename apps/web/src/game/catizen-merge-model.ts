// apps/web/src/game/catizen-merge-model.ts
// Pure client mathematical model and game rules for Catizen-style item progression

export interface MergeItem {
  type: 'item';
  id: string;
  tier: number;
}

export interface MergeParcel {
  type: 'parcel';
  id: string;
  spawnTime: number;
}

export type MergeSlot = MergeItem | MergeParcel | null;

export interface TierDefinition {
  tier: number;
  name: string;
  title: string;
  dps: number; // passive cash per second
  mergeReward: number; // one-time cash reward on creation
  accentColor: string;
  iconSymbol: string;
}

export const MERGE_TIERS: TierDefinition[] = [
  {
    tier: 1,
    name: 'Bronz Çip',
    title: 'Bronze Chip',
    dps: 1,
    mergeReward: 10,
    accentColor: '#cd7f32',
    iconSymbol: '⚡',
  },
  {
    tier: 2,
    name: 'Gümüş Külçe',
    title: 'Silver Ingot',
    dps: 3,
    mergeReward: 25,
    accentColor: '#c0c0c0',
    iconSymbol: '🏛️',
  },
  {
    tier: 3,
    name: 'Altın Kasa',
    title: 'Gold Safe',
    dps: 8,
    mergeReward: 70,
    accentColor: '#ffd700',
    iconSymbol: '📦',
  },
  {
    tier: 4,
    name: 'Platin Sunucu',
    title: 'Platinum Server',
    dps: 20,
    mergeReward: 180,
    accentColor: '#00e5ff',
    iconSymbol: '💻',
  },
  {
    tier: 5,
    name: 'Kripto Çekirdek',
    title: 'Crypto Core',
    dps: 50,
    mergeReward: 480,
    accentColor: '#7b61ff',
    iconSymbol: '💎',
  },
  {
    tier: 6,
    name: 'Kuantum Düğüm',
    title: 'Quantum Node',
    dps: 125,
    mergeReward: 1250,
    accentColor: '#ff007a',
    iconSymbol: '⚛️',
  },
  {
    tier: 7,
    name: 'Siber Ağ',
    title: 'Cyber Network',
    dps: 300,
    mergeReward: 3200,
    accentColor: '#00ff88',
    iconSymbol: '🌐',
  },
  {
    tier: 8,
    name: 'Yapay Zeka Matrisi',
    title: 'AI Neural Matrix',
    dps: 750,
    mergeReward: 8500,
    accentColor: '#ff9900',
    iconSymbol: '🧠',
  },
  {
    tier: 9,
    name: 'Galaktik Blokzincir',
    title: 'Galactic Blockchain',
    dps: 1800,
    mergeReward: 22000,
    accentColor: '#3d7aff',
    iconSymbol: '🪐',
  },
  {
    tier: 10,
    name: 'İmparatorluk Tacı',
    title: 'Imperial Crown',
    dps: 4500,
    mergeReward: 60000,
    accentColor: '#e1b47e',
    iconSymbol: '👑',
  },
  {
    tier: 11,
    name: 'Tekillik Çekirdeği',
    title: 'Singularity Core',
    dps: 10000,
    mergeReward: 150000,
    accentColor: '#ff3366',
    iconSymbol: '🌌',
  },
  {
    tier: 12,
    name: 'Kozmik Egemenlik',
    title: 'Cosmic Dominance',
    dps: 25000,
    mergeReward: 400000,
    accentColor: '#ffffff',
    iconSymbol: '✨',
  },
];

export const MAX_MERGE_TIER = 12;
export const DEFAULT_BOARD_SIZE = 12; // 4x3 grid

export function getTierDefinition(tier: number): TierDefinition {
  const def = MERGE_TIERS.find((t) => t.tier === tier);
  if (!def) {
    // Graceful fallback for tier beyond table
    return {
      tier,
      name: `Kademe ${tier}`,
      title: `Tier ${tier}`,
      dps: Math.floor(25000 * Math.pow(2.5, tier - 12)),
      mergeReward: Math.floor(400000 * Math.pow(2.6, tier - 12)),
      accentColor: '#e1b47e',
      iconSymbol: '🌟',
    };
  }
  return def;
}

let nextItemId = 1;
export function generateSlotId(prefix = 'slot'): string {
  return `${prefix}-${Date.now()}-${nextItemId++}`;
}

export function createInitialBoard(size = DEFAULT_BOARD_SIZE): MergeSlot[] {
  const board: MergeSlot[] = Array(size).fill(null);
  // Initial onboarding distribution: 2 bronze chips, 1 silver ingot
  board[0] = { type: 'item', tier: 1, id: generateSlotId('init-1') };
  board[1] = { type: 'item', tier: 1, id: generateSlotId('init-2') };
  board[2] = { type: 'item', tier: 2, id: generateSlotId('init-3') };
  return board;
}

export function canMergeSlots(
  board: MergeSlot[],
  fromIndex: number,
  toIndex: number,
): boolean {
  if (fromIndex === toIndex) return false;
  if (fromIndex < 0 || fromIndex >= board.length) return false;
  if (toIndex < 0 || toIndex >= board.length) return false;

  const fromSlot = board[fromIndex];
  const toSlot = board[toIndex];

  if (!fromSlot || fromSlot.type !== 'item') return false;
  if (!toSlot || toSlot.type !== 'item') return false;

  return fromSlot.tier === toSlot.tier && fromSlot.tier < MAX_MERGE_TIER;
}

export function executeMerge(
  board: MergeSlot[],
  fromIndex: number,
  toIndex: number,
): {
  board: MergeSlot[];
  newTier: number;
  reward: number;
  targetId: string;
} | null {
  if (!canMergeSlots(board, fromIndex, toIndex)) return null;

  const fromSlot = board[fromIndex] as MergeItem;
  const newTier = fromSlot.tier + 1;
  const tierDef = getTierDefinition(newTier);
  const targetId = generateSlotId(`t${newTier}`);

  const nextBoard = [...board];
  nextBoard[fromIndex] = null;
  nextBoard[toIndex] = {
    type: 'item',
    tier: newTier,
    id: targetId,
  };

  return {
    board: nextBoard,
    newTier,
    reward: tierDef.mergeReward,
    targetId,
  };
}

export function moveOrSwapSlot(
  board: MergeSlot[],
  fromIndex: number,
  toIndex: number,
): {
  board: MergeSlot[];
  merged: boolean;
  reward?: number;
  newTier?: number;
} | null {
  if (fromIndex === toIndex) return null;
  if (fromIndex < 0 || fromIndex >= board.length) return null;
  if (toIndex < 0 || toIndex >= board.length) return null;

  const fromSlot = board[fromIndex];
  if (!fromSlot) return null;

  const toSlot = board[toIndex];

  // If destination is empty, simple move
  if (!toSlot) {
    const nextBoard = [...board];
    nextBoard[toIndex] = fromSlot;
    nextBoard[fromIndex] = null;
    return { board: nextBoard, merged: false };
  }

  // If both are items of identical tier, merge!
  if (
    fromSlot.type === 'item' &&
    toSlot.type === 'item' &&
    fromSlot.tier === toSlot.tier &&
    fromSlot.tier < MAX_MERGE_TIER
  ) {
    const mergeResult = executeMerge(board, fromIndex, toIndex);
    if (!mergeResult) return null;
    return {
      board: mergeResult.board,
      merged: true,
      reward: mergeResult.reward,
      newTier: mergeResult.newTier,
    };
  }

  // Otherwise swap positions
  const nextBoard = [...board];
  nextBoard[fromIndex] = toSlot;
  nextBoard[toIndex] = fromSlot;
  return { board: nextBoard, merged: false };
}

export function spawnParcel(
  board: MergeSlot[],
  forcedIndex?: number,
): { board: MergeSlot[]; index: number } | null {
  const emptyIndices: number[] = [];
  board.forEach((slot, index) => {
    if (slot === null) emptyIndices.push(index);
  });

  if (emptyIndices.length === 0) return null;

  let targetIndex: number;
  if (
    forcedIndex !== undefined &&
    forcedIndex >= 0 &&
    forcedIndex < board.length &&
    board[forcedIndex] === null
  ) {
    targetIndex = forcedIndex;
  } else {
    const pick = Math.floor(Math.random() * emptyIndices.length);
    targetIndex = emptyIndices[pick]!;
  }

  const nextBoard = [...board];
  nextBoard[targetIndex] = {
    type: 'parcel',
    id: generateSlotId('parcel'),
    spawnTime: Date.now(),
  };

  return { board: nextBoard, index: targetIndex };
}

export function openParcel(
  board: MergeSlot[],
  index: number,
  forcedTier?: number,
): { board: MergeSlot[]; tier: number } | null {
  if (index < 0 || index >= board.length) return null;
  const slot = board[index];
  if (!slot || slot.type !== 'parcel') return null;

  // 75% Tier 1, 25% Tier 2
  const tier =
    forcedTier !== undefined ? forcedTier : Math.random() < 0.75 ? 1 : 2;

  const nextBoard = [...board];
  nextBoard[index] = {
    type: 'item',
    tier,
    id: generateSlotId(`t${tier}`),
  };

  return { board: nextBoard, tier };
}

export function calculateBoardDps(board: MergeSlot[]): number {
  return board.reduce((acc, slot) => {
    if (slot && slot.type === 'item') {
      const def = getTierDefinition(slot.tier);
      return acc + def.dps;
    }
    return acc;
  }, 0);
}

export function calculateIdleEarnings(
  dps: number,
  elapsedSeconds: number,
): number {
  if (dps <= 0 || elapsedSeconds <= 0) return 0;
  return Math.floor(dps * elapsedSeconds);
}

export function findAutoMergeCandidate(
  board: MergeSlot[],
): [number, number] | null {
  // Collect item slots by tier
  const tierMap = new Map<number, number[]>();
  board.forEach((slot, index) => {
    if (slot && slot.type === 'item' && slot.tier < MAX_MERGE_TIER) {
      const existing = tierMap.get(slot.tier) ?? [];
      existing.push(index);
      tierMap.set(slot.tier, existing);
    }
  });

  // Sort tiers ascending so we merge lowest tier first
  const sortedTiers = Array.from(tierMap.keys()).sort((a, b) => a - b);
  for (const tier of sortedTiers) {
    const indices = tierMap.get(tier)!;
    if (indices.length >= 2) {
      return [indices[0]!, indices[1]!];
    }
  }

  return null;
}

export function findFirstParcel(board: MergeSlot[]): number | null {
  for (let i = 0; i < board.length; i++) {
    if (board[i]?.type === 'parcel') {
      return i;
    }
  }
  return null;
}
