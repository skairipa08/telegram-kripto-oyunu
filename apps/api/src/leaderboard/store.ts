import type { RawScoreEntry } from '@empire/game-core';

export interface LeaderboardSeasonInfo {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'frozen' | 'ended';
  startsAt: string;
  endsAt: string;
  sruSnapshot: number;
}

export interface FreezeSeasonResult {
  seasonId: string;
  status: 'frozen';
  frozenAt: string;
  archivedParticipantsCount: number;
}

export interface LeaderboardStore {
  getActiveOrSpecifiedSeason(
    seasonId?: string,
  ): Promise<LeaderboardSeasonInfo | null>;
  getScores(seasonId: string): Promise<RawScoreEntry[]>;
  getFriendUserIds(userId: string): Promise<string[]>;
  freezeSeason(
    seasonId: string,
    adminUserId?: string,
    reason?: string,
  ): Promise<FreezeSeasonResult>;
}

export class SupabaseLeaderboardStore implements LeaderboardStore {
  private readonly fetcher: typeof fetch;
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    fetcher: typeof fetch = fetch,
  ) {
    this.fetcher = (...args: Parameters<typeof fetch>) => fetcher(...args);
  }

  private async rpc(
    name: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const response = await this.fetcher(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: 'manual',
    });
    if (!response.ok) {
      throw new Error(
        `Database RPC ${name} failed with status ${response.status}`,
      );
    }
    return response.json();
  }

  async getActiveOrSpecifiedSeason(
    seasonId?: string,
  ): Promise<LeaderboardSeasonInfo | null> {
    const data = await this.rpc('empire_leaderboard_get_season', {
      p_season_id: seasonId ?? null,
    });
    return data ? (data as LeaderboardSeasonInfo) : null;
  }

  async getScores(seasonId: string): Promise<RawScoreEntry[]> {
    const data = await this.rpc('empire_leaderboard_get_scores', {
      p_season_id: seasonId,
    });
    return (data as RawScoreEntry[]) ?? [];
  }

  async getFriendUserIds(userId: string): Promise<string[]> {
    const data = await this.rpc('empire_leaderboard_get_friends', {
      p_user_id: userId,
    });
    return (data as string[]) ?? [];
  }

  async freezeSeason(
    seasonId: string,
    adminUserId?: string,
    reason?: string,
  ): Promise<FreezeSeasonResult> {
    const data = (await this.rpc('empire_leaderboard_freeze', {
      p_season_id: seasonId,
      p_admin_user_id: adminUserId ?? null,
      p_reason: reason ?? null,
    })) as {
      error?: string;
      seasonId: string;
      status: 'frozen';
      frozenAt: string;
      archivedParticipantsCount: number;
    };

    if (data.error) {
      throw new Error(data.error);
    }
    return data;
  }
}
