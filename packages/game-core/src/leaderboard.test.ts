import { describe, expect, it } from 'vitest';
import {
  canMutateSeasonScores,
  compareLeaderboardEntries,
  decodeLeaderboardCursor,
  encodeLeaderboardCursor,
  filterFriendsLeaderboard,
  isSeasonFrozen,
  paginateLeaderboard,
  pinUserRank,
  rankLeaderboardEntries,
  type RawScoreEntry,
} from './leaderboard';

describe('Leaderboard Engine', () => {
  const sampleEntries: RawScoreEntry[] = [
    {
      userId: 'user-c',
      points: 1000,
      updatedAt: '2026-09-14T10:00:00Z',
      username: 'alice',
      firstName: 'Alice',
    },
    {
      userId: 'user-a',
      points: 1000,
      updatedAt: '2026-09-14T10:00:00Z',
      username: 'bob',
      firstName: 'Bob',
    },
    {
      userId: 'user-b',
      points: 1000,
      updatedAt: '2026-09-14T09:00:00Z', // earlier timestamp wins
      username: 'charlie',
      firstName: 'Charlie',
    },
    {
      userId: 'user-d',
      points: 2500,
      updatedAt: '2026-09-14T12:00:00Z',
      username: 'dave',
      firstName: 'Dave',
    },
    {
      userId: 'user-e',
      points: 500,
      updatedAt: '2026-09-14T08:00:00Z',
      username: 'eve',
      firstName: 'Eve',
    },
  ];

  it('ranks entries with deterministic tie-breaking (points DESC, updatedAt ASC, userId ASC)', () => {
    const ranked = rankLeaderboardEntries(sampleEntries, 'user-a');

    expect(ranked).toHaveLength(5);
    // 1st: user-d (2500 points)
    expect(ranked[0]?.userId).toBe('user-d');
    expect(ranked[0]?.rank).toBe(1);

    // 2nd: user-b (1000 points, 09:00:00Z - earlier than user-a and user-c)
    expect(ranked[1]?.userId).toBe('user-b');
    expect(ranked[1]?.rank).toBe(2);

    // 3rd: user-a (1000 points, 10:00:00Z, 'user-a' < 'user-c')
    expect(ranked[2]?.userId).toBe('user-a');
    expect(ranked[2]?.rank).toBe(3);
    expect(ranked[2]?.isCurrentUser).toBe(true);

    // 4th: user-c (1000 points, 10:00:00Z, 'user-c' > 'user-a')
    expect(ranked[3]?.userId).toBe('user-c');
    expect(ranked[3]?.rank).toBe(4);
    expect(ranked[3]?.isCurrentUser).toBe(false);

    // 5th: user-e (500 points)
    expect(ranked[4]?.userId).toBe('user-e');
    expect(ranked[4]?.rank).toBe(5);
  });

  it('handles empty leaderboard gracefully', () => {
    const ranked = rankLeaderboardEntries([]);
    expect(ranked).toEqual([]);

    const pinned = pinUserRank([], 'some-user');
    expect(pinned).toEqual({
      rank: null,
      points: 0,
      missionPoints: 0,
      referralPoints: 0,
    });

    const paginated = paginateLeaderboard([]);
    expect(paginated).toEqual({
      entries: [],
      totalCount: 0,
      nextCursor: null,
      hasMore: false,
    });
  });

  it('pins exact user rank when present or absent', () => {
    const ranked = rankLeaderboardEntries(sampleEntries, 'user-b');

    const pinnedFound = pinUserRank(ranked, 'user-b');
    expect(pinnedFound).toEqual({
      rank: 2,
      points: 1000,
      missionPoints: 0,
      referralPoints: 0,
    });

    const pinnedNotFound = pinUserRank(ranked, 'non-existent-user');
    expect(pinnedNotFound).toEqual({
      rank: null,
      points: 0,
      missionPoints: 0,
      referralPoints: 0,
    });

    const pinnedUndefined = pinUserRank(ranked, undefined);
    expect(pinnedUndefined.rank).toBeNull();
  });

  it('encodes and decodes keyset cursor correctly', () => {
    const payload = {
      points: 1250,
      updatedAt: '2026-09-14T10:00:00.000Z',
      userId: '77777777-7777-7777-7777-777777777777',
    };

    const encoded = encodeLeaderboardCursor(payload);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(10);

    const decoded = decodeLeaderboardCursor(encoded);
    expect(decoded).toEqual(payload);

    // Corrupt cursor
    expect(decodeLeaderboardCursor('invalid-base64-!@#$%')).toBeNull();
    expect(decodeLeaderboardCursor('')).toBeNull();
    expect(
      decodeLeaderboardCursor(
        Buffer.from(JSON.stringify({ bad: 'data' })).toString('base64'),
      ),
    ).toBeNull();
  });

  it('paginates entries using limit and nextCursor', () => {
    const ranked = rankLeaderboardEntries(sampleEntries);

    // Page 1: limit 2
    const page1 = paginateLeaderboard(ranked, { limit: 2 });
    expect(page1.entries).toHaveLength(2);
    expect(page1.entries[0]?.userId).toBe('user-d');
    expect(page1.entries[1]?.userId).toBe('user-b');
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2: with cursor from page 1
    const page2 = paginateLeaderboard(ranked, {
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.entries).toHaveLength(2);
    expect(page2.entries[0]?.userId).toBe('user-a');
    expect(page2.entries[1]?.userId).toBe('user-c');
    expect(page2.hasMore).toBe(true);
    expect(page2.nextCursor).not.toBeNull();

    // Page 3: last item
    const page3 = paginateLeaderboard(ranked, {
      limit: 2,
      cursor: page2.nextCursor,
    });
    expect(page3.entries).toHaveLength(1);
    expect(page3.entries[0]?.userId).toBe('user-e');
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();
  });

  it('supports offset pagination fallback', () => {
    const ranked = rankLeaderboardEntries(sampleEntries);
    const paged = paginateLeaderboard(ranked, { limit: 2, offset: 2 });
    expect(paged.entries).toHaveLength(2);
    expect(paged.entries[0]?.userId).toBe('user-a');
    expect(paged.entries[1]?.userId).toBe('user-c');
  });

  it('filters friends leaderboard to user and connections', () => {
    const filtered = filterFriendsLeaderboard(sampleEntries, 'user-a', [
      'user-c',
    ]);
    expect(filtered).toHaveLength(2);
    const ids = filtered.map((f) => f.userId);
    expect(ids).toContain('user-a');
    expect(ids).toContain('user-c');
    expect(ids).not.toContain('user-b');
  });

  it('validates season freeze and score mutation state', () => {
    expect(canMutateSeasonScores('active')).toBe(true);
    expect(canMutateSeasonScores('upcoming')).toBe(false);
    expect(canMutateSeasonScores('frozen')).toBe(false);
    expect(canMutateSeasonScores('ended')).toBe(false);

    expect(isSeasonFrozen('active')).toBe(false);
    expect(isSeasonFrozen('upcoming')).toBe(false);
    expect(isSeasonFrozen('frozen')).toBe(true);
    expect(isSeasonFrozen('ended')).toBe(true);
  });

  it('compares identical records deterministically', () => {
    const record1 = {
      points: 500,
      updatedAt: '2026-09-14T00:00:00Z',
      userId: 'u1',
    };
    const record2 = {
      points: 500,
      updatedAt: '2026-09-14T00:00:00Z',
      userId: 'u1',
    };
    expect(compareLeaderboardEntries(record1, record2)).toBe(0);
  });
});
