import type {
  TONWalletProvider,
  WalletConnectionRecord,
} from '@empire/game-core';

export interface UserAirdropStats {
  seasonPoints: number;
  cashEarned: number;
  streakDays: number;
  qualifiedReferrals: number;
}

export interface WalletStore {
  getWallet(userId: string): Promise<WalletConnectionRecord | null>;
  getWalletByAddress(address: string): Promise<WalletConnectionRecord | null>;
  saveWallet(record: WalletConnectionRecord): Promise<void>;
  disconnectWallet(userId: string): Promise<boolean>;
  getUserAirdropStats(userId: string): Promise<UserAirdropStats>;
}

/**
 * In-memory Wallet Store for high-speed deterministic integration & unit testing.
 */
export class InMemoryWalletStore implements WalletStore {
  private readonly wallets = new Map<string, WalletConnectionRecord>(); // userId -> record
  private readonly addressIndex = new Map<string, string>(); // address -> userId
  private readonly userStats = new Map<string, UserAirdropStats>();

  constructor(
    initialWallets: WalletConnectionRecord[] = [],
    initialStats: Record<string, UserAirdropStats> = {},
  ) {
    for (const w of initialWallets) {
      this.wallets.set(w.userId, w);
      this.addressIndex.set(w.address.toLowerCase(), w.userId);
    }
    for (const [uid, stats] of Object.entries(initialStats)) {
      this.userStats.set(uid, stats);
    }
  }

  async getWallet(userId: string): Promise<WalletConnectionRecord | null> {
    return this.wallets.get(userId) ?? null;
  }

  async getWalletByAddress(address: string): Promise<WalletConnectionRecord | null> {
    const userId = this.addressIndex.get(address.toLowerCase());
    if (!userId) return null;
    return this.wallets.get(userId) ?? null;
  }

  async saveWallet(record: WalletConnectionRecord): Promise<void> {
    const existing = this.wallets.get(record.userId);
    if (existing) {
      this.addressIndex.delete(existing.address.toLowerCase());
    }
    this.wallets.set(record.userId, record);
    this.addressIndex.set(record.address.toLowerCase(), record.userId);
  }

  async disconnectWallet(userId: string): Promise<boolean> {
    const existing = this.wallets.get(userId);
    if (!existing) return false;
    this.addressIndex.delete(existing.address.toLowerCase());
    this.wallets.delete(userId);
    return true;
  }

  async getUserAirdropStats(userId: string): Promise<UserAirdropStats> {
    return (
      this.userStats.get(userId) ?? {
        seasonPoints: 1000,
        cashEarned: 50000,
        streakDays: 3,
        qualifiedReferrals: 1,
      }
    );
  }

  setUserStats(userId: string, stats: UserAirdropStats): void {
    this.userStats.set(userId, stats);
  }
}

/**
 * Production Supabase Wallet Store querying PostgreSQL database.
 */
export class SupabaseWalletStore implements WalletStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private get headers() {
    return {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
  }

  async getWallet(userId: string): Promise<WalletConnectionRecord | null> {
    try {
      const res = await this.fetcher(
        `${this.url}/rest/v1/user_wallets?user_id=eq.${encodeURIComponent(userId)}&select=*`,
        { headers: this.headers, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{
        user_id: string;
        address: string;
        wallet_provider: TONWalletProvider;
        connected_at: string;
        verified: boolean;
        is_locked: boolean;
        public_key?: string;
      }>;
      const row = rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        address: row.address,
        walletProvider: row.wallet_provider,
        connectedAt: row.connected_at,
        verified: row.verified,
        isLockedForAirdrop: row.is_locked,
        publicKey: row.public_key,
      };
    } catch {
      return null;
    }
  }

  async getWalletByAddress(address: string): Promise<WalletConnectionRecord | null> {
    try {
      const res = await this.fetcher(
        `${this.url}/rest/v1/user_wallets?address=eq.${encodeURIComponent(address)}&select=*`,
        { headers: this.headers, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{
        user_id: string;
        address: string;
        wallet_provider: TONWalletProvider;
        connected_at: string;
        verified: boolean;
        is_locked: boolean;
        public_key?: string;
      }>;
      const row = rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        address: row.address,
        walletProvider: row.wallet_provider,
        connectedAt: row.connected_at,
        verified: row.verified,
        isLockedForAirdrop: row.is_locked,
        publicKey: row.public_key,
      };
    } catch {
      return null;
    }
  }

  async saveWallet(record: WalletConnectionRecord): Promise<void> {
    await this.fetcher(`${this.url}/rest/v1/user_wallets`, {
      method: 'POST',
      headers: {
        ...this.headers,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: record.userId,
        address: record.address,
        wallet_provider: record.walletProvider,
        connected_at: record.connectedAt,
        verified: record.verified,
        is_locked: record.isLockedForAirdrop,
        public_key: record.publicKey ?? null,
      }),
      signal: AbortSignal.timeout(5000),
    });
  }

  async disconnectWallet(userId: string): Promise<boolean> {
    const res = await this.fetcher(
      `${this.url}/rest/v1/user_wallets?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: this.headers,
        signal: AbortSignal.timeout(5000),
      },
    );
    return res.ok;
  }

  async getUserAirdropStats(userId: string): Promise<UserAirdropStats> {
    try {
      const res = await this.fetcher(
        `${this.url}/rest/v1/game_profiles?user_id=eq.${encodeURIComponent(userId)}&select=season_points,cash,streak_days,referral_count`,
        { headers: this.headers, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) {
        return { seasonPoints: 0, cashEarned: 0, streakDays: 0, qualifiedReferrals: 0 };
      }
      const rows = (await res.json()) as Array<{
        season_points?: number;
        cash?: number;
        streak_days?: number;
        referral_count?: number;
      }>;
      const row = rows[0];
      return {
        seasonPoints: row?.season_points ?? 0,
        cashEarned: row?.cash ?? 0,
        streakDays: row?.streak_days ?? 0,
        qualifiedReferrals: row?.referral_count ?? 0,
      };
    } catch {
      return { seasonPoints: 0, cashEarned: 0, streakDays: 0, qualifiedReferrals: 0 };
    }
  }
}
