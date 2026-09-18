import type {
  NoncePurpose,
  TONWalletProvider,
  WalletConnectionRecord,
} from '@empire/game-core';

export interface UserAirdropStats {
  seasonPoints: number;
  cashEarned: number;
  streakDays: number;
  qualifiedReferrals: number;
}

export interface StoredNonce {
  nonceId: string;
  userId: string;
  purpose: NoncePurpose;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

export interface AirdropClaimRecord {
  userId: string;
  seasonId: string;
  canonicalAddress: string;
  points: number;
  tier: string;
  claimedAt: string;
}

export interface WalletStore {
  getWallet(userId: string): Promise<WalletConnectionRecord | null>;
  getWalletByAddress(address: string): Promise<WalletConnectionRecord | null>;
  saveWallet(record: WalletConnectionRecord): Promise<{ success: boolean; code?: string; error?: string }>;
  disconnectWallet(userId: string): Promise<boolean>;
  getUserAirdropStats(userId: string): Promise<UserAirdropStats>;

  // Nonce management & atomic replay protection
  saveNonce(nonce: StoredNonce): Promise<void>;
  consumeNonce(
    nonceId: string,
    userId: string,
    purpose: NoncePurpose,
    currentTimestamp: number,
  ): Promise<{ success: boolean; reason?: string }>;

  // Airdrop claims & double-claim protection
  getClaim(userId: string, seasonId: string): Promise<AirdropClaimRecord | null>;
  claimAirdrop(claim: AirdropClaimRecord): Promise<{ success: boolean; code?: string; error?: string }>;
}

/**
 * High-performance, concurrent-safe In-Memory Wallet Store for testing.
 */
export class InMemoryWalletStore implements WalletStore {
  private readonly wallets = new Map<string, WalletConnectionRecord>(); // userId -> record
  private readonly addressIndex = new Map<string, string>(); // canonicalAddress -> userId
  private readonly userStats = new Map<string, UserAirdropStats>();
  private readonly nonces = new Map<string, StoredNonce>(); // nonceId -> StoredNonce
  private readonly claims = new Map<string, AirdropClaimRecord>(); // userId:seasonId -> record
  private readonly addressClaims = new Set<string>(); // canonicalAddress:seasonId

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

  async saveWallet(record: WalletConnectionRecord): Promise<{ success: boolean; code?: string; error?: string }> {
    const canonical = record.address.toLowerCase();
    const existingHolder = this.addressIndex.get(canonical);

    // Anti-Sybil rule: Address cannot be linked to a different account
    if (existingHolder && existingHolder !== record.userId) {
      return {
        success: false,
        code: 'WALLET_ALREADY_LINKED',
        error: 'Bu TON cüzdanı başka bir hesaba zaten bağlanmış (Sybil koruması).',
      };
    }

    const currentRecord = this.wallets.get(record.userId);
    if (currentRecord?.isLockedForAirdrop) {
      return {
        success: false,
        code: 'WALLET_LOCKED',
        error: 'Cüzdan snapshot için kilitlenmiştir ve artık değiştirilemez.',
      };
    }

    if (currentRecord) {
      this.addressIndex.delete(currentRecord.address.toLowerCase());
    }

    this.wallets.set(record.userId, record);
    this.addressIndex.set(canonical, record.userId);

    return { success: true };
  }

  async disconnectWallet(userId: string): Promise<boolean> {
    const existing = this.wallets.get(userId);
    if (!existing) return false;
    if (existing.isLockedForAirdrop) return false;
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

  async saveNonce(nonce: StoredNonce): Promise<void> {
    this.nonces.set(nonce.nonceId, { ...nonce });
  }

  async consumeNonce(
    nonceId: string,
    userId: string,
    purpose: NoncePurpose,
    currentTimestamp: number,
  ): Promise<{ success: boolean; reason?: string }> {
    const entry = this.nonces.get(nonceId);
    if (!entry) {
      return { success: false, reason: 'NONCE_NOT_FOUND' };
    }
    if (entry.consumed) {
      return { success: false, reason: 'NONCE_ALREADY_USED' };
    }
    if (entry.userId !== userId) {
      return { success: false, reason: 'USER_MISMATCH' };
    }
    if (entry.purpose !== purpose) {
      return { success: false, reason: 'PURPOSE_MISMATCH' };
    }
    if (entry.expiresAt < currentTimestamp) {
      return { success: false, reason: 'NONCE_EXPIRED' };
    }

    // Atomic consumption: Set consumed flag immediately
    entry.consumed = true;
    return { success: true };
  }

  async getClaim(userId: string, seasonId: string): Promise<AirdropClaimRecord | null> {
    return this.claims.get(`${userId}:${seasonId}`) ?? null;
  }

  async claimAirdrop(claim: AirdropClaimRecord): Promise<{ success: boolean; code?: string; error?: string }> {
    const userKey = `${claim.userId}:${claim.seasonId}`;
    if (this.claims.has(userKey)) {
      return {
        success: false,
        code: 'ALREADY_CLAIMED',
        error: 'Bu sezon için airdrop ödülü daha önce talep edilmiştir.',
      };
    }

    const addressKey = `${claim.canonicalAddress.toLowerCase()}:${claim.seasonId}`;
    if (this.addressClaims.has(addressKey)) {
      return {
        success: false,
        code: 'WALLET_ALREADY_CLAIMED',
        error: 'Bu cüzdan adresi ile bu sezonda daha önce airdrop talep edilmiştir.',
      };
    }

    this.claims.set(userKey, claim);
    this.addressClaims.add(addressKey);
    return { success: true };
  }
}

/**
 * Production Supabase Wallet Store querying PostgreSQL database via Supabase REST & RPCs.
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
        friendly_address: string;
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
        friendlyAddress: row.friendly_address || row.address,
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
        friendly_address: string;
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
        friendlyAddress: row.friendly_address || row.address,
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

  async saveWallet(record: WalletConnectionRecord): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const res = await this.fetcher(`${this.url}/rest/v1/rpc/empire_connect_wallet`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          p_user_id: record.userId,
          p_canonical_address: record.address,
          p_friendly_address: record.friendlyAddress,
          p_provider: record.walletProvider,
          p_public_key: record.publicKey ?? null,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return { success: false, code: 'DB_ERROR', error: 'Veritabanı bağlantı hatası.' };
      }

      const outcome = (await res.json()) as { success: boolean; code?: string; error?: string };
      return outcome;
    } catch (err) {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: err instanceof Error ? err.message : 'Bağlantı hatası.',
      };
    }
  }

  async disconnectWallet(userId: string): Promise<boolean> {
    const res = await this.fetcher(
      `${this.url}/rest/v1/user_wallets?user_id=eq.${encodeURIComponent(userId)}&is_locked=eq.false`,
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

  async saveNonce(nonce: StoredNonce): Promise<void> {
    await this.fetcher(`${this.url}/rest/v1/auth_nonces`, {
      method: 'POST',
      headers: { ...this.headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        nonce_id: nonce.nonceId,
        user_id: nonce.userId,
        purpose: nonce.purpose,
        consumed: false,
        issued_at: new Date(nonce.issuedAt * 1000).toISOString(),
        expires_at: new Date(nonce.expiresAt * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  }

  async consumeNonce(
    nonceId: string,
    userId: string,
    purpose: NoncePurpose,
    _currentTimestamp: number,
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      const res = await this.fetcher(`${this.url}/rest/v1/rpc/empire_consume_nonce`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          p_nonce_id: nonceId,
          p_user_id: userId,
          p_purpose: purpose,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return { success: false, reason: 'NONCE_STORE_ERROR' };
      }

      const outcome = (await res.json()) as { success: boolean; error?: string };
      if (!outcome.success) {
        return { success: false, reason: outcome.error || 'NONCE_CONSUME_FAILED' };
      }

      return { success: true };
    } catch {
      return { success: false, reason: 'NONCE_STORE_EXCEPTION' };
    }
  }

  async getClaim(userId: string, seasonId: string): Promise<AirdropClaimRecord | null> {
    try {
      const res = await this.fetcher(
        `${this.url}/rest/v1/airdrop_claims?user_id=eq.${encodeURIComponent(userId)}&season_id=eq.${encodeURIComponent(seasonId)}&select=*`,
        { headers: this.headers, signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as Array<{
        user_id: string;
        season_id: string;
        canonical_address: string;
        points: number;
        tier: string;
        claimed_at: string;
      }>;
      const row = rows[0];
      if (!row) return null;
      return {
        userId: row.user_id,
        seasonId: row.season_id,
        canonicalAddress: row.canonical_address,
        points: Number(row.points),
        tier: row.tier,
        claimedAt: row.claimed_at,
      };
    } catch {
      return null;
    }
  }

  async claimAirdrop(claim: AirdropClaimRecord): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const res = await this.fetcher(`${this.url}/rest/v1/airdrop_claims`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          user_id: claim.userId,
          season_id: claim.seasonId,
          canonical_address: claim.canonicalAddress,
          points: claim.points,
          tier: claim.tier,
          claimed_at: claim.claimedAt,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (errText.includes('uq_airdrop_claims_user_season')) {
          return { success: false, code: 'ALREADY_CLAIMED', error: 'Ödül bu sezon için zaten talep edilmiş.' };
        }
        if (errText.includes('uq_airdrop_claims_address_season')) {
          return { success: false, code: 'WALLET_ALREADY_CLAIMED', error: 'Bu cüzdan bu sezon için zaten kullanılmış.' };
        }
        return { success: false, code: 'DB_ERROR', error: 'Veritabanı kayıt hatası.' };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: err instanceof Error ? err.message : 'Kayıt hatası.',
      };
    }
  }
}
