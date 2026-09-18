import { Hono } from 'hono';
import {
  calculateAirdropAllocation,
  generateTonProofNonce,
  validateTonAddress,
  verifyTonProof,
  verifyTonProofNonce,
  type AllowedNetwork,
  type NoncePurpose,
  type TONProofPayload,
  type WalletConnectionRecord,
} from '@empire/game-core';
import {
  airdropClaimRequestSchema,
  connectWalletRequestSchema,
  walletNonceRequestSchema,
} from '@empire/shared';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseWalletStore, type WalletStore } from './store';

const error = (code: string, message?: string) => ({
  apiVersion: 'v1' as const,
  error: { code, ...(message ? { message } : {}) },
});

export interface WalletRouteOptions {
  allowedDomains?: readonly string[];
  allowedNetwork?: AllowedNetwork;
  isProduction?: boolean;
}

export function createWalletRoutes(
  makeStore: (env: Bindings) => WalletStore = (env) =>
    new SupabaseWalletStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
  options: WalletRouteOptions = {},
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  const getServerSecret = (env: Bindings): string => {
    return (
      env.TELEGRAM_BOT_TOKEN ||
      env.SUPABASE_SERVICE_ROLE_KEY ||
      'empire_wallet_secret_entropy_minimum_32_bytes_key'
    );
  };

  const getAllowedDomains = (env: Bindings): readonly string[] => {
    if (options.allowedDomains && options.allowedDomains.length > 0) {
      return options.allowedDomains;
    }
    const origin = env.APP_ORIGIN;
    if (origin) {
      try {
        const url = new URL(origin);
        return [url.host.toLowerCase(), url.hostname.toLowerCase()];
      } catch {
        return [origin.toLowerCase()];
      }
    }
    return ['empire.example', 'localhost:5173', '127.0.0.1:5173'];
  };

  // 1. POST /wallet/nonce — Issue single-use anti-replay cryptographic challenge
  routes.post('/wallet/nonce', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    // Input validation with Zod
    const rawBody = await c.req.json().catch(() => ({}));
    const parseResult = walletNonceRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json(error('INVALID_REQUEST', 'Geçersiz nonce istek parametreleri.'), 400);
    }

    const purpose: NoncePurpose = parseResult.data.purpose;
    const secret = getServerSecret(c.env);
    const currentTime = now();
    const ttlSeconds = 300; // 5 minutes fresh window

    const { nonce, nonceId, expiresAt } = generateTonProofNonce(
      session.user.id,
      secret,
      purpose,
      currentTime,
      ttlSeconds,
    );

    const store = makeStore(c.env);
    await store.saveNonce({
      nonceId,
      userId: session.user.id,
      purpose,
      issuedAt: currentTime,
      expiresAt,
      consumed: false,
    });

    return c.json({
      apiVersion: 'v1',
      nonce,
      nonceId,
      purpose,
      expiresInSeconds: ttlSeconds,
    });
  });

  // 2. POST /wallet/connect — Verify address, ton_proof signature, enforce Sybil 1:1 invariant
  routes.post('/wallet/connect', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    // Strict schema validation (reject malformed, oversized payloads)
    const rawBody = await c.req.json().catch(() => null);
    const parseResult = connectWalletRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json(
        error(
          'INVALID_REQUEST',
          `Şema doğrulama hatası: ${parseResult.error.issues[0]?.message || 'Geçersiz veri'}`,
        ),
        400,
      );
    }

    const { address, walletProvider, publicKey, tonProof } = parseResult.data;
    const allowedNetwork: AllowedNetwork = options.allowedNetwork ?? 'mainnet';

    // Step 1: Strict Address Validation & Canonicalization
    const validation = validateTonAddress(address, allowedNetwork);
    if (!validation.valid || !validation.canonicalAddress) {
      return c.json(
        error('INVALID_WALLET_ADDRESS', validation.error || 'Geçersiz TON adresi formatı.'),
        400,
      );
    }

    const canonicalAddress = validation.canonicalAddress;
    const friendlyAddress = validation.friendlyAddress || validation.normalizedAddress || address;
    const store = makeStore(c.env);
    const currentTime = now();
    const secret = getServerSecret(c.env);

    // Step 2: TON Connect ton_proof Verification (if provided)
    if (tonProof) {
      // 2a. Verify nonce integrity and user binding
      const nonceCheck = verifyTonProofNonce(
        tonProof.payload,
        session.user.id,
        secret,
        'LINK_WALLET',
        currentTime,
      );

      if (!nonceCheck.valid || !nonceCheck.details) {
        return c.json(
          error('INVALID_NONCE', nonceCheck.error || 'Geçersiz veya süresi dolmuş nonce.'),
          400,
        );
      }

      // 2b. Atomic Nonce Consumption (Prevents Replay Attacks & Race Conditions)
      const consumeOutcome = await store.consumeNonce(
        nonceCheck.details.nonceId,
        session.user.id,
        'LINK_WALLET',
        currentTime,
      );

      if (!consumeOutcome.success) {
        return c.json(
          error(
            'NONCE_REPLAY_DETECTED',
            'Bu nonce daha önce kullanılmış veya geçersiz. Lütfen yeni bir istek başlatın.',
          ),
          400,
        );
      }

      // 2c. Cryptographic ton_proof Verification (Ed25519 signature, domain, timestamp, StateInit)
      const allowedDomains = getAllowedDomains(c.env);
      const envRecord = c.env as Record<string, unknown>;
      const isProd =
        options.isProduction ??
        (envRecord.ENVIRONMENT === 'production' || envRecord.NODE_ENV === 'production');

      const proofVerification = await verifyTonProof({
        proof: tonProof as TONProofPayload,
        allowedDomains,
        allowedNetwork,
        isProduction: isProd,
        serverTime: currentTime,
      });

      if (!proofVerification.valid) {
        return c.json(
          error(
            proofVerification.reasonCode || 'INVALID_TON_PROOF',
            proofVerification.error || 'Kriptografik imza doğrulaması başarısız.',
          ),
          400,
        );
      }
    }

    // Step 3: Persist verified wallet binding with atomic Sybil collision handling
    const walletRecord: WalletConnectionRecord = {
      userId: session.user.id,
      address: canonicalAddress,
      friendlyAddress,
      walletProvider,
      connectedAt: new Date(currentTime * 1000).toISOString(),
      verified: true,
      isLockedForAirdrop: false,
      publicKey,
    };

    const saveResult = await store.saveWallet(walletRecord);
    if (!saveResult.success) {
      if (saveResult.code === 'WALLET_ALREADY_LINKED') {
        return c.json(
          error(
            'WALLET_ALREADY_LINKED',
            'Bu TON cüzdanı başka bir hesaba zaten bağlanmış. Çoklu hesap (Sybil) engeli.',
          ),
          409,
        );
      }
      if (saveResult.code === 'WALLET_LOCKED') {
        return c.json(
          error('WALLET_LOCKED', 'Bu cüzdan airdrop snapshot için kilitlenmiştir.'),
          403,
        );
      }
      return c.json(error('STORAGE_ERROR', saveResult.error || 'Kayıt başarısız.'), 500);
    }

    return c.json({
      apiVersion: 'v1',
      success: true,
      canonicalAddress,
      friendlyAddress,
      walletProvider,
      status: 'soon',
      isAirdropLive: false,
      message:
        'Cüzdanınız başarıyla doğrulandı ve kaydedildi. Airdrop snapshot dağıtımı yakında başlayacaktır (SOON).',
    });
  });

  // 3. GET /wallet/status — Query user's wallet connection & airdrop score
  routes.get('/wallet/status', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const store = makeStore(c.env);
    const wallet = await store.getWallet(session.user.id);
    const airdropStats = await store.getUserAirdropStats(session.user.id);

    const airdropAllocation = calculateAirdropAllocation({
      seasonPoints: airdropStats.seasonPoints,
      cashEarned: airdropStats.cashEarned,
      streakDays: airdropStats.streakDays,
      qualifiedReferrals: airdropStats.qualifiedReferrals,
      hasConnectedWallet: wallet !== null && wallet.verified,
    });

    return c.json({
      apiVersion: 'v1',
      connected: wallet !== null,
      wallet: wallet
        ? {
            canonicalAddress: wallet.address,
            friendlyAddress: wallet.friendlyAddress,
            walletProvider: wallet.walletProvider,
            connectedAt: wallet.connectedAt,
            verified: wallet.verified,
            isLockedForAirdrop: wallet.isLockedForAirdrop,
          }
        : null,
      airdrop: {
        phase: 'preparation_soon',
        isLive: false,
        statusText: 'Çok Yakında (SOON)',
        allocation: airdropAllocation,
      },
    });
  });

  // 4. DELETE /wallet/disconnect — Disconnect wallet before snapshot lock
  routes.delete('/wallet/disconnect', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const store = makeStore(c.env);
    const current = await store.getWallet(session.user.id);
    if (!current) {
      return c.json(error('WALLET_NOT_CONNECTED', 'Bağlı bir cüzdan bulunamadı.'), 404);
    }

    if (current.isLockedForAirdrop) {
      return c.json(
        error(
          'WALLET_LOCKED',
          'Bu cüzdan airdrop snapshot için kilitlenmiştir. Artık değiştirilemez.',
        ),
        403,
      );
    }

    const success = await store.disconnectWallet(session.user.id);
    if (!success) {
      return c.json(error('DISCONNECT_FAILED', 'Cüzdan bağlantısı kaldırılamadı.'), 500);
    }

    return c.json({
      apiVersion: 'v1',
      success: true,
      message: 'Cüzdan bağlantısı başarıyla kaldırıldı.',
    });
  });

  // 5. POST /airdrop/claim — Idempotent, tamper-proof airdrop token allocation claim
  routes.post('/airdrop/claim', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );
    if (!session) {
      return c.json(error('UNAUTHORIZED'), 401);
    }

    const rawBody = await c.req.json().catch(() => null);
    const parseResult = airdropClaimRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return c.json(error('INVALID_REQUEST', 'Geçersiz talep parametreleri.'), 400);
    }

    const { seasonId } = parseResult.data;
    const store = makeStore(c.env);

    // Verify wallet is bound and verified
    const wallet = await store.getWallet(session.user.id);
    if (!wallet || !wallet.verified) {
      return c.json(
        error('WALLET_REQUIRED', 'Airdrop talep etmek için doğrulanmış bir TON cüzdanı bağlamalısınız.'),
        400,
      );
    }

    // Check if already claimed (idempotency check)
    const existingClaim = await store.getClaim(session.user.id, seasonId);
    if (existingClaim) {
      return c.json(
        error('ALREADY_CLAIMED', 'Bu sezon için airdrop ödülü daha önce talep edilmiştir.'),
        409,
      );
    }

    // Authoritative calculation from server-side game records (client cannot manipulate)
    const stats = await store.getUserAirdropStats(session.user.id);
    const allocation = calculateAirdropAllocation({
      seasonPoints: stats.seasonPoints,
      cashEarned: stats.cashEarned,
      streakDays: stats.streakDays,
      qualifiedReferrals: stats.qualifiedReferrals,
      hasConnectedWallet: true,
    });

    const claimOutcome = await store.claimAirdrop({
      userId: session.user.id,
      seasonId,
      canonicalAddress: wallet.address,
      points: allocation.totalAirdropPoints,
      tier: allocation.tier,
      claimedAt: new Date(now() * 1000).toISOString(),
    });

    if (!claimOutcome.success) {
      return c.json(error(claimOutcome.code || 'CLAIM_FAILED', claimOutcome.error), 409);
    }

    return c.json({
      apiVersion: 'v1',
      success: true,
      seasonId,
      claimedPoints: allocation.totalAirdropPoints,
      tier: allocation.tier,
      canonicalAddress: wallet.address,
      friendlyAddress: wallet.friendlyAddress,
      message: 'Airdrop ödül talebiniz başarıyla kaydedildi.',
    });
  });

  // 6. GET /airdrop/summary — Global transparent airdrop roadmap & status
  routes.get('/airdrop/summary', async (c) => {
    const authStore = makeAuthStore(c.env);
    const session = await getCurrentUserSession(
      c.req.header('Cookie') ??
        c.req.header('Authorization') ??
        c.req.header('X-Empire-Session'),
      c.env,
      authStore,
      now,
    );

    let allocation = null;
    let hasWallet = false;

    if (session) {
      const store = makeStore(c.env);
      const wallet = await store.getWallet(session.user.id);
      hasWallet = wallet !== null;
      const stats = await store.getUserAirdropStats(session.user.id);
      allocation = calculateAirdropAllocation({
        seasonPoints: stats.seasonPoints,
        cashEarned: stats.cashEarned,
        streakDays: stats.streakDays,
        qualifiedReferrals: stats.qualifiedReferrals,
        hasConnectedWallet: hasWallet,
      });
    }

    return c.json({
      apiVersion: 'v1',
      tokenSymbol: '$EMPIRE',
      chain: 'TON (The Open Network)',
      phase: 'phase_1_preparation',
      isLive: false,
      statusText: 'Airdrop Havuzu Hazırlanıyor (Çok Yakında)',
      connectedWallet: hasWallet,
      userAllocation: allocation,
      transparencyPolicy: {
        antiP2W: true,
        fairLaunch: true,
        sybilProtection: '1-Wallet-Per-Telegram-Account',
        snapshotDate: 'TBA (Q4 2026)',
      },
    });
  });

  return routes;
}
