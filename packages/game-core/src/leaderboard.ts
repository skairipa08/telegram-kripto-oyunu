export interface RawScoreEntry {
  userId: string;
  points: number;
  missionPoints?: number;
  referralPoints?: number;
  updatedAt: string;
  username?: string | null;
  firstName?: string;
}

export interface RankedLeaderboardEntry {
  rank: number;
  userId: string;
  points: number;
  missionPoints: number;
  referralPoints: number;
  updatedAt: string;
  username: string | null;
  firstName: string;
  isCurrentUser: boolean;
}

export interface LeaderboardCursorPayload {
  points: number;
  updatedAt: string;
  userId: string;
}

export interface PaginatedLeaderboardResult {
  entries: RankedLeaderboardEntry[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UserPinnedRank {
  rank: number | null;
  points: number;
  missionPoints: number;
  referralPoints: number;
}

/**
 * Deterministic tie-breaking comparator:
 * 1. points DESC (highest score ranks first)
 * 2. updated_at ASC (earliest timestamp ranks first)
 * 3. user_id ASC (lexicographical UUID order guarantees 100% determinism)
 */
export function compareLeaderboardEntries(
  a: { points: number; updatedAt: string; userId: string },
  b: { points: number; updatedAt: string; userId: string },
): number {
  if (b.points !== a.points) {
    return b.points - a.points;
  }

  const timeA = new Date(a.updatedAt).getTime();
  const timeB = new Date(b.updatedAt).getTime();
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  return a.userId.localeCompare(b.userId);
}

/**
 * Pure function that ranks a list of score records using deterministic tie-breaking.
 */
export function rankLeaderboardEntries(
  entries: readonly RawScoreEntry[],
  currentUserId?: string,
): RankedLeaderboardEntry[] {
  const sorted = [...entries].sort(compareLeaderboardEntries);

  return sorted.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    points: entry.points,
    missionPoints: entry.missionPoints ?? 0,
    referralPoints: entry.referralPoints ?? 0,
    updatedAt: entry.updatedAt,
    username: entry.username ?? null,
    firstName: entry.firstName ?? '',
    isCurrentUser: Boolean(currentUserId && entry.userId === currentUserId),
  }));
}

/**
 * Finds and pins the exact rank and scores for the specified user.
 * Returns rank: null if user is unranked / not present.
 */
export function pinUserRank(
  rankedEntries: readonly RankedLeaderboardEntry[],
  currentUserId?: string,
): UserPinnedRank {
  if (!currentUserId) {
    return { rank: null, points: 0, missionPoints: 0, referralPoints: 0 };
  }

  const found = rankedEntries.find((entry) => entry.userId === currentUserId);
  if (!found) {
    return { rank: null, points: 0, missionPoints: 0, referralPoints: 0 };
  }

  return {
    rank: found.rank,
    points: found.points,
    missionPoints: found.missionPoints,
    referralPoints: found.referralPoints,
  };
}

/**
 * Base64 encodes keyset cursor payload.
 */
export function encodeLeaderboardCursor(
  payload: LeaderboardCursorPayload,
): string {
  const json = JSON.stringify({
    points: payload.points,
    updatedAt: payload.updatedAt,
    userId: payload.userId,
  });

  if (typeof btoa === 'function') {
    return btoa(json);
  }
  return Buffer.from(json, 'utf8').toString('base64');
}

/**
 * Decodes and validates keyset cursor string.
 */
export function decodeLeaderboardCursor(
  cursor: string,
): LeaderboardCursorPayload | null {
  try {
    const raw =
      typeof atob === 'function'
        ? atob(cursor)
        : Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.points === 'number' &&
      typeof parsed.updatedAt === 'string' &&
      typeof parsed.userId === 'string'
    ) {
      return {
        points: parsed.points,
        updatedAt: parsed.updatedAt,
        userId: parsed.userId,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Paginates an already ranked array of leaderboard entries using cursor or offset.
 */
export function paginateLeaderboard(
  rankedEntries: readonly RankedLeaderboardEntry[],
  options: {
    limit?: number | undefined;
    cursor?: string | null | undefined;
    offset?: number | undefined;
  } = {},
): PaginatedLeaderboardResult {
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
  let startIndex = 0;

  if (options.cursor) {
    const decoded = decodeLeaderboardCursor(options.cursor);
    if (decoded) {
      // Find the first entry that comes strictly after the cursor entry in sort order
      const foundIdx = rankedEntries.findIndex(
        (entry) => compareLeaderboardEntries(entry, decoded) > 0,
      );
      startIndex = foundIdx >= 0 ? foundIdx : rankedEntries.length;
    }
  } else if (typeof options.offset === 'number' && options.offset > 0) {
    startIndex = Math.min(options.offset, rankedEntries.length);
  }

  const paged = rankedEntries.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + paged.length < rankedEntries.length;

  let nextCursor: string | null = null;
  const lastItem = paged[paged.length - 1];
  if (hasMore && lastItem) {
    nextCursor = encodeLeaderboardCursor({
      points: lastItem.points,
      updatedAt: lastItem.updatedAt,
      userId: lastItem.userId,
    });
  }

  return {
    entries: paged,
    totalCount: rankedEntries.length,
    nextCursor,
    hasMore,
  };
}

/**
 * Filters scores to include only the current player and their referral connections.
 */
export function filterFriendsLeaderboard(
  scores: readonly RawScoreEntry[],
  currentUserId: string,
  friendUserIds: readonly string[],
): RawScoreEntry[] {
  const friendsSet = new Set([currentUserId, ...friendUserIds]);
  return scores.filter((entry) => friendsSet.has(entry.userId));
}

/**
 * Checks if season score mutations are permitted based on season status.
 */
export function canMutateSeasonScores(seasonStatus: string): boolean {
  return seasonStatus === 'active';
}

/**
 * Checks if season is frozen or ended.
 */
export function isSeasonFrozen(seasonStatus: string): boolean {
  return seasonStatus === 'frozen' || seasonStatus === 'ended';
}
