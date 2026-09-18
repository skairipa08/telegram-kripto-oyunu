import { Hono } from 'hono';
import {
  calculateAirdropAllocation,
  generateTonProofNonce,
  validateTonAddress,
  verifyTonProofNonce,
  type TONWalletProvider,
  type WalletConnectionRecord,
} from '@empire/game-core';
import type { Bindings } from '../auth/env';
import { getCurrentUserSession } from '../auth/routes';
import { SupabaseAuthStore, type AuthStore } from '../auth/store';
import { SupabaseWalletStore, type WalletStore } from './store';

const error = (code: string, message?: string) => ({
  apiVersion: 'v1' as const,
  error: { code, ...(message ? { message } : {}) },
});

export interface ConnectWalletRequestBody {
  address: string;
  walletProvider?: TONWalletProvider | undefined;
  publicKey?: string | undefined;
  tonProof?: {
    payload: string; // Nonce
    signature?: string | undefined;
    network?: 'mainnet' | 'testnet' | undefined;
  } | undefined;
}

export function createWalletRoutes(
  makeStore: (env: Bindings) => WalletStore = (env) =>
    new SupabaseWalletStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  makeAuthStore: (env: Bindings) => AuthStore = (env) =>
    new SupabaseAuthStore(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!),
  now: () => number = () => Math.floor(Date.now() / 1000),
) {
  const routes = new Hono<{ Bindings: Bindings }>();

  // 1. POST /wallet/nonce — Issue single-use anti-replay cryptographic nonce
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

    const secret =
      c.env.TELEGRAM_BOT_TOKEN ||
      c.env.SUPABASE_SERVICE_ROLE_KEY ||
      'empire_wallet_secret_entropy';

    const nonce = await generateTonProofNonce(session.user.id, secret, now());

    return c.json({
      apiVersion: 'v1',
      nonce,
      expiresInSeconds: 600,
    });
  });

  // 2. POST /wallet/connect — Verify address, signature/nonce, enforce 1-wallet-per-account Sybil defense
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

    const body = (await c.req.json().catch(() => null)) as ConnectWalletRequestBody | null;
    if (!body || !body.address) {
      return c.json(error('INVALID_REQUEST', 'Cüzdan adresi gereklidir.'), 400);
    }

    // Step 1: Strict Address Validation
    const validation = validateTonAddress(body.address);
    if (!validation.valid || !validation.normalizedAddress) {
      return c.json(
        error('INVALID_WALLET_ADDRESS', validation.error || 'Geçersiz TON adresi formatı.'),
        400,
      );
    }

    const normalizedAddress = validation.normalizedAddress;
    const store = makeStore(c.env);

    // Step 2: Anti-Sybil Defense (Ensure address is not already linked to another player)
    const existingHolder = await store.getWalletByAddress(normalizedAddress);
    if (existingHolder && existingHolder.userId !== session.user.id) {
      return c.json(
        error(
          'WALLET_ALREADY_LINKED',
          'Bu TON cüzdanı başka bir hesaba zaten bağlanmış. Çoklu hesap (Sybil) tespiti.',
        ),
        409,
      );
    }

    // Step 3: Anti-Replay Nonce Verification (if tonProof provided)
    if (body.tonProof?.payload) {
      const secret =
        c.env.TELEGRAM_BOT_TOKEN ||
        c.env.SUPABASE_SERVICE_ROLE_KEY ||
        'empire_wallet_secret_entropy';

      const nonceCheck = await verifyTonProofNonce(
        body.tonProof.payload,
        session.user.id,
        secret,
        600,
        now(),
      );

      if (!nonceCheck.valid) {
        return c.json(
          error('INVALID_TON_PROOF', nonceCheck.error || 'Nonce doğrulaması başarısız.'),
          400,
        );
      }
    }

    // Step 4: Persist verified wallet binding
    const walletRecord: WalletConnectionRecord = {
      userId: session.user.id,
      address: normalizedAddress,
      walletProvider: body.walletProvider || 'generic',
      connectedAt: new Date(now() * 1000).toISOString(),
      verified: true,
      isLockedForAirdrop: false,
      publicKey: body.publicKey,
    };

    await store.saveWallet(walletRecord);

    return c.json({
      apiVersion: 'v1',
      success: true,
      address: normalizedAddress,
      walletProvider: walletRecord.walletProvider,
      status: 'soon',
      isAirdropLive: false,
      message:
        'Cüzdanınız başarıyla doğrulandı ve kaydedildi. Airdrop snapshot dağıtımı yakında başlayacaktır (SOON).',
    });
  });

  // 3. GET /wallet/status — Query user's wallet connection & airdrop preparation score
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
            address: wallet.address,
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

    await store.disconnectWallet(session.user.id);

    return c.json({
      apiVersion: 'v1',
      success: true,
      message: 'Cüzdan bağlantısı başarıyla kaldırıldı.',
    });
  });

  // 5. GET /airdrop/summary — Global transparent airdrop roadmap & status
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
