import type { UserCohortData } from '@empire/game-core';
import type { TrackAnalyticsEventItem } from '@empire/shared';

export interface AnalyticsMetricsRaw {
  totalUsers: number;
  payingUsers: number;
  totalStarsRevenue: number;
  activatedUsers: number;
}

export interface AnalyticsStore {
  recordEvents(
    events: readonly TrackAnalyticsEventItem[],
    userId?: string | null,
    sessionId?: string | null,
  ): Promise<number>;
  getCohortData(): Promise<UserCohortData[]>;
  getMetrics(): Promise<AnalyticsMetricsRaw>;
}

export class SupabaseAnalyticsStore implements AnalyticsStore {
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

  async recordEvents(
    events: readonly TrackAnalyticsEventItem[],
    userId?: string | null,
    sessionId?: string | null,
  ): Promise<number> {
    const data = (await this.rpc('empire_analytics_track', {
      p_user_id: userId ?? null,
      p_session_id: sessionId ?? null,
      p_events: events,
    })) as { acceptedCount: number };
    return data?.acceptedCount ?? events.length;
  }

  async getCohortData(): Promise<UserCohortData[]> {
    const data = await this.rpc('empire_analytics_get_cohort_data', {});
    return (data as UserCohortData[]) ?? [];
  }

  async getMetrics(): Promise<AnalyticsMetricsRaw> {
    const data = await this.rpc('empire_analytics_get_metrics', {});
    return (
      (data as AnalyticsMetricsRaw) ?? {
        totalUsers: 0,
        payingUsers: 0,
        totalStarsRevenue: 0,
        activatedUsers: 0,
      }
    );
  }
}
