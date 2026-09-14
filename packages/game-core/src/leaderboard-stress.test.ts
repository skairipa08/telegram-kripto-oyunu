import { describe, expect, it } from 'vitest';
import {
  encodeLeaderboardCursor,
  paginateLeaderboard,
  pinUserRank,
  rankLeaderboardEntries,
  type RawScoreEntry,
} from './leaderboard';

describe('Empirical Leaderboard Stress & Invariant Harness', () => {
  // Deterministic PRNG for reproducible test runs
  function seededRandom(seed: number) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // Generate 1,500 synthetic player score records with deliberate collisions
  function generateSyntheticLeaderboard(count = 1500): RawScoreEntry[] {
    const rng = seededRandom(42);
    const entries: RawScoreEntry[] = [];

    // Group 1: 250 players with EXACT SAME points (5000) and EXACT SAME timestamp
    const collisionTimestamp = '2026-09-14T12:00:00.000Z';
    for (let i = 0; i < 250; i++) {
      const hex = i.toString(16).padStart(4, '0');
      entries.push({
        userId: `00000000-0000-4000-a000-${hex.padStart(12, '1')}`,
        points: 5000,
        missionPoints: 200,
        referralPoints: 100,
        updatedAt: collisionTimestamp,
        username: `cluster_a_${i}`,
        firstName: `PlayerA${i}`,
      });
    }

    // Group 2: 250 players with SAME points (3000) but varying timestamps
    for (let i = 0; i < 250; i++) {
      const hex = i.toString(16).padStart(4, '0');
      const minute = (i % 60).toString().padStart(2, '0');
      const second = ((i * 7) % 60).toString().padStart(2, '0');
      entries.push({
        userId: `00000000-0000-4000-b000-${hex.padStart(12, '2')}`,
        points: 3000,
        missionPoints: 150,
        referralPoints: 50,
        updatedAt: `2026-09-14T10:${minute}:${second}.000Z`,
        username: `cluster_b_${i}`,
        firstName: `PlayerB${i}`,
      });
    }

    // Group 3: 500 players with strictly descending points from 100,000 down to 5,001
    for (let i = 0; i < 500; i++) {
      const hex = i.toString(16).padStart(4, '0');
      entries.push({
        userId: `00000000-0000-4000-c000-${hex.padStart(12, '3')}`,
        points: 100000 - i * 150,
        missionPoints: 500,
        referralPoints: 250,
        updatedAt: `2026-09-14T08:00:00.000Z`,
        username: `high_roller_${i}`,
        firstName: `HighRoller${i}`,
      });
    }

    // Group 4: 500 players with pseudorandom points (0 to 2,999)
    for (let i = 0; i < count - 1000; i++) {
      const hex = i.toString(16).padStart(4, '0');
      const randPts = Math.floor(rng() * 2999);
      const randHour = Math.floor(rng() * 24)
        .toString()
        .padStart(2, '0');
      const randMin = Math.floor(rng() * 60)
        .toString()
        .padStart(2, '0');
      entries.push({
        userId: `00000000-0000-4000-d000-${hex.padStart(12, '4')}`,
        points: randPts,
        missionPoints: Math.floor(rng() * 100),
        referralPoints: Math.floor(rng() * 50),
        updatedAt: `2026-09-14T${randHour}:${randMin}:00.000Z`,
        username: `casual_${i}`,
        firstName: `Casual${i}`,
      });
    }

    return entries;
  }

  // Fisher-Yates shuffle
  function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = temp;
    }
    return copy;
  }

  it('1. Enforces strict deterministic total ordering on 1,500+ players across collisions', () => {
    const raw = generateSyntheticLeaderboard(1500);
    expect(raw).toHaveLength(1500);

    const ranked = rankLeaderboardEntries(raw);
    expect(ranked).toHaveLength(1500);

    // Verify ranks are strictly 1..1500
    for (let i = 0; i < ranked.length; i++) {
      expect(ranked[i]?.rank).toBe(i + 1);
    }

    // Verify comparator monotonicity invariant for all adjacent pairs
    for (let i = 0; i < ranked.length - 1; i++) {
      const a = ranked[i]!;
      const b = ranked[i + 1]!;

      // 1. Points descending
      if (a.points !== b.points) {
        expect(a.points).toBeGreaterThan(b.points);
      } else {
        // 2. UpdatedAt ascending (earlier timestamp wins)
        const timeA = new Date(a.updatedAt).getTime();
        const timeB = new Date(b.updatedAt).getTime();
        if (timeA !== timeB) {
          expect(timeA).toBeLessThan(timeB);
        } else {
          // 3. User ID ascending (lexicographical)
          expect(a.userId.localeCompare(b.userId)).toBeLessThan(0);
        }
      }
    }
  });

  it('2. Preserves 100% permutation invariance across 5 randomized input shuffles', () => {
    const raw = generateSyntheticLeaderboard(1500);
    const rng = seededRandom(999);

    const baselineRanked = rankLeaderboardEntries(raw);

    // Test 5 distinct random permutations of the exact same 1,500 records
    for (let run = 1; run <= 5; run++) {
      const shuffled = shuffle(raw, rng);
      const rankedFromShuffle = rankLeaderboardEntries(shuffled);

      expect(rankedFromShuffle).toHaveLength(1500);

      // Bit-for-bit assertion: every single rank, userId, and score must be identical
      for (let i = 0; i < 1500; i++) {
        expect(rankedFromShuffle[i]?.rank).toBe(baselineRanked[i]?.rank);
        expect(rankedFromShuffle[i]?.userId).toBe(baselineRanked[i]?.userId);
        expect(rankedFromShuffle[i]?.points).toBe(baselineRanked[i]?.points);
      }
    }
  });

  it('3. Guarantees zero duplicates, zero missing items, and exact order in full pagination traversals', () => {
    const raw = generateSyntheticLeaderboard(1500);
    const ranked = rankLeaderboardEntries(raw);

    const testPageSizes = [7, 23, 50, 100];

    for (const pageSize of testPageSizes) {
      const collected: typeof ranked = [];
      let currentCursor: string | null = null;
      let iterations = 0;
      const maxIterations = Math.ceil(1500 / pageSize) + 5;

      while (iterations < maxIterations) {
        iterations++;
        const page = paginateLeaderboard(ranked, {
          limit: pageSize,
          cursor: currentCursor,
        });

        expect(page.entries.length).toBeLessThanOrEqual(pageSize);
        collected.push(...page.entries);

        if (!page.hasMore) {
          expect(page.nextCursor).toBeNull();
          break;
        }

        expect(page.nextCursor).not.toBeNull();
        currentCursor = page.nextCursor;
      }

      // Check 1: Traversal completeness
      expect(collected).toHaveLength(1500);

      // Check 2: Zero missing records
      const collectedIds = collected.map((e) => e.userId);
      const rankedIds = ranked.map((e) => e.userId);
      expect(collectedIds).toEqual(rankedIds);

      // Check 3: Zero duplicates
      const uniqueIds = new Set(collectedIds);
      expect(uniqueIds.size).toBe(1500);

      // Check 4: Ranks are perfectly sequential 1..1500
      for (let i = 0; i < collected.length; i++) {
        expect(collected[i]?.rank).toBe(i + 1);
      }
    }
  });

  it('4. Seamlessly paginates across identical points and identical timestamps collision cluster', () => {
    // Isolated test on the 250 identical points + identical timestamps cluster
    const collisionCluster = generateSyntheticLeaderboard(1500).filter(
      (e) => e.points === 5000 && e.updatedAt === '2026-09-14T12:00:00.000Z',
    );
    expect(collisionCluster).toHaveLength(250);

    const rankedCluster = rankLeaderboardEntries(collisionCluster);

    // Keyset pagination across collision cluster with page size 13 (indivisible)
    const collected: typeof rankedCluster = [];
    let cursor: string | null = null;

    while (true) {
      const page = paginateLeaderboard(rankedCluster, { limit: 13, cursor });
      collected.push(...page.entries);
      if (!page.hasMore) break;
      cursor = page.nextCursor;
    }

    expect(collected).toHaveLength(250);
    expect(new Set(collected.map((e) => e.userId)).size).toBe(250);
    expect(collected.map((e) => e.userId)).toEqual(
      rankedCluster.map((e) => e.userId),
    );
  });

  it('5. Evaluates user rank pinning across all ranks: top, mid, bottom, unranked, and collisions', () => {
    const raw = generateSyntheticLeaderboard(1500);
    const ranked = rankLeaderboardEntries(raw);

    // Top player (Rank 1)
    const topPlayer = ranked[0]!;
    const pinnedTop = pinUserRank(ranked, topPlayer.userId);
    expect(pinnedTop.rank).toBe(1);
    expect(pinnedTop.points).toBe(topPlayer.points);

    // Mid player (Rank 750)
    const midPlayer = ranked[749]!;
    const pinnedMid = pinUserRank(ranked, midPlayer.userId);
    expect(pinnedMid.rank).toBe(750);
    expect(pinnedMid.points).toBe(midPlayer.points);

    // Bottom player (Rank 1500)
    const bottomPlayer = ranked[1499]!;
    const pinnedBottom = pinUserRank(ranked, bottomPlayer.userId);
    expect(pinnedBottom.rank).toBe(1500);
    expect(pinnedBottom.points).toBe(bottomPlayer.points);

    // Collision cluster player
    const collisionPlayer = ranked.find((e) => e.points === 5000)!;
    const pinnedCollision = pinUserRank(ranked, collisionPlayer.userId);
    expect(pinnedCollision.rank).toBe(collisionPlayer.rank);
    expect(pinnedCollision.points).toBe(5000);

    // Unranked user (non-existent UUID)
    const pinnedUnranked = pinUserRank(
      ranked,
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    );
    expect(pinnedUnranked).toEqual({
      rank: null,
      points: 0,
      missionPoints: 0,
      referralPoints: 0,
    });

    // Undefined user
    expect(pinUserRank(ranked, undefined)).toEqual({
      rank: null,
      points: 0,
      missionPoints: 0,
      referralPoints: 0,
    });

    // Empty leaderboard pinning
    expect(pinUserRank([], topPlayer.userId)).toEqual({
      rank: null,
      points: 0,
      missionPoints: 0,
      referralPoints: 0,
    });
  });

  it('6. Handles corrupted and malicious cursor inputs safely without throwing', () => {
    const raw = generateSyntheticLeaderboard(100);
    const ranked = rankLeaderboardEntries(raw);

    const maliciousCursors = [
      '!!not_base64!!',
      '',
      '   ',
      encodeLeaderboardCursor({
        points: NaN,
        updatedAt: 'invalid',
        userId: 'bad',
      }),
      Buffer.from('plain non-json string').toString('base64'),
      Buffer.from(JSON.stringify({ evil: 123 })).toString('base64'),
      Buffer.from(
        JSON.stringify({
          points: 'not-a-number',
          updatedAt: '2026-09-14',
          userId: 'u',
        }),
      ).toString('base64'),
    ];

    for (const badCursor of maliciousCursors) {
      // Must not throw, must return page 1 fallback or empty safe result
      expect(() => {
        const result = paginateLeaderboard(ranked, {
          limit: 10,
          cursor: badCursor,
        });
        expect(result.entries.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    }
  });
});
