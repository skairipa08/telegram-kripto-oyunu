export function memoryRewardForRound(round: number): number {
  if (!Number.isFinite(round) || round <= 0) return 0;
  return Math.min(120, 6 + (Math.floor(round) - 1) * 4);
}

export function extendMemorySequence(
  sequence: number[],
  round: number,
): number[] {
  return [...sequence, (round * 3 + sequence.length * 2 + 1) % 4];
}

export function findMergePair(board: number[]): [number, number] | null {
  for (let first = 0; first < board.length; first += 1) {
    for (let second = first + 1; second < board.length; second += 1) {
      if (board[first] === board[second]) return [first, second];
    }
  }
  return null;
}

export function mergeCoinBoard(
  board: number[],
  first: number,
  second: number,
  move: number,
): { board: number[]; reward: number; mergedLevel: number } | null {
  if (
    first === second ||
    first < 0 ||
    second < 0 ||
    first >= board.length ||
    second >= board.length ||
    board[first] !== board[second]
  ) {
    return null;
  }

  const mergedLevel = Math.min(7, board[second]! + 1);
  const next = [...board];
  next[first] = (move % 2) + 1;
  next[second] = mergedLevel;
  return {
    board: next,
    reward: 4 * 2 ** (mergedLevel - 2),
    mergedLevel,
  };
}
