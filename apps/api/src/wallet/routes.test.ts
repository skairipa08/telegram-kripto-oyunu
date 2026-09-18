import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { createTonProofHash, createTonProofMessage } from '@empire/game-core';
import type { Bindings } from '../auth/env';
import { createTestDatabase } from '../auth/test-db';
import { createApp } from '../index';
import { InMemoryWalletStore } from './store';

const now = Math.floor(Date.now() / 1000);
const origin = 'https://empire.example';
const env: Bindings = {
  TELEGRAM_BOT_TOKEN: '123456:test-wallet-bot',
  SESSION_SECRET: 'test-only-session-secret-with-enough-entropy-for-wallet',
  APP_ORIGIN: origin,
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createApp>;
let testUser1: { cookie: string; userId: string };
let testUser2: { cookie: string; userId: string };
let walletStore: InMemoryWalletStore;

// Precomputed valid mainnet bounceable address with account hash
const TEST_HASH_HEX = '6f5bc67986e06430961d9df00433926a4cd92e597ddd8aa3a47a33ad44599c00';
const validBounceable = 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcAIRy';

// Ed25519 keypair for cryptographic proof signing in tests
const seed = Buffer.alloc(32, 7);
const keyPair = keyPairFromSeed(seed);
const publicKeyHex = keyPair.publicKey.toString('hex');

function initData(id: number, username: string) {
  const fields = {
    auth_date: String(now),
    query_id: `query-wallet-${id}`,
    user: JSON.stringify({ id, first_name: `WalletUser${id}`, username }),
  };
  const check = Object.entries(fields)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const key = createHmac('sha256', 'WebAppData')
    .update(env.TELEGRAM_BOT_TOKEN!)
    .digest();
  return new URLSearchParams({
    ...fields,
    hash: createHmac('sha256', key).update(check).digest('hex'),
  }).toString();
}

function createSignedProof(payloadNonce: string, domainHost = 'empire.example', timestamp = now) {
  const domainLengthBytes = Buffer.byteLength(domainHost, 'utf8');
  const msg = createTonProofMessage({
    workchain: 0,
    accountHash: Buffer.from(TEST_HASH_HEX, 'hex'),
    domainLengthBytes,
    domainValue: domainHost,
    timestamp,
    payload: payloadNonce,
  });
  const toSign = createTonProofHash(msg);
  const signature = sign(toSign, keyPair.secretKey).toString('base64');

  return {
    address: validBounceable,
    domain: {
      lengthBytes: domainLengthBytes,
      value: domainHost,
    },
    timestamp,
    payload: payloadNonce,
    signature,
    publicKey: publicKeyHex,
  };
}

describe('TON Wallet & Airdrop API Routes Integration Suite', () => {
  let user1ActiveNonce: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    walletStore = new InMemoryWalletStore();

    app = createApp(
      {
        makeAuthStore: () => database.store,
        makeWalletStore: () => walletStore,
      },
      () => now,
    );

    // Login test user 1
    const res1 = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(1001, 'wallet_player_1'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const cookie1 = res1.headers.get('set-cookie')?.split(';')[0] ?? '';
    const body1 = (await res1.json()) as { user: { id: string } };
    testUser1 = { cookie: cookie1, userId: body1.user.id };

    // Login test user 2 (for Sybil testing)
    const res2 = await app.request(
      '/auth/telegram',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData(1002, 'wallet_player_2'),
          requestId: crypto.randomUUID(),
        }),
      },
      env,
    );
    const cookie2 = res2.headers.get('set-cookie')?.split(';')[0] ?? '';
    const body2 = (await res2.json()) as { user: { id: string } };
    testUser2 = { cookie: cookie2, userId: body2.user.id };
  });

  it('generates cryptographic nonce for authenticated user', async () => {
    const res = await app.request(
      '/wallet/nonce',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purpose: 'LINK_WALLET' }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { nonce: string; expiresInSeconds: number };
    expect(body.nonce).toContain('tonproof_');
    expect(body.expiresInSeconds).toBe(300);
    user1ActiveNonce = body.nonce;
  });

  it('rejects unauthenticated requests to wallet endpoints', async () => {
    const res = await app.request(
      '/wallet/status',
      { method: 'GET', headers: { Origin: origin } },
      env,
    );
    expect(res.status).toBe(401);

    const claimRes = await app.request(
      '/airdrop/claim',
      {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId: 'season_1', requestId: crypto.randomUUID() }),
      },
      env,
    );
    expect(claimRes.status).toBe(401);
  });

  it('rejects connect request with invalid address format', async () => {
    const res = await app.request(
      '/wallet/connect',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: 'invalid_ton_address_123',
          walletProvider: 'tonkeeper',
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_WALLET_ADDRESS');
  });

  it('rejects connect request with forged or invalid ton_proof signature', async () => {
    const forgedProof = createSignedProof(user1ActiveNonce);
    // Tamper with signature
    forgedProof.signature = Buffer.alloc(64, 0).toString('base64');

    const res = await app.request(
      '/wallet/connect',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: validBounceable,
          walletProvider: 'tonkeeper',
          publicKey: publicKeyHex,
          tonProof: forgedProof,
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('connects valid TON wallet successfully with valid tonProof and marks status as soon', async () => {
    // Generate fresh nonce for connect
    const nonceRes = await app.request(
      '/wallet/nonce',
      {
        method: 'POST',
        headers: { Cookie: testUser1.cookie, Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'LINK_WALLET' }),
      },
      env,
    );
    const { nonce } = (await nonceRes.json()) as { nonce: string };
    user1ActiveNonce = nonce;

    const validProof = createSignedProof(user1ActiveNonce);

    const connectRes = await app.request(
      '/wallet/connect',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: validBounceable,
          walletProvider: 'tonkeeper',
          publicKey: publicKeyHex,
          tonProof: validProof,
        }),
      },
      env,
    );

    expect(connectRes.status).toBe(200);
    const body = (await connectRes.json()) as {
      success: boolean;
      status: string;
      isAirdropLive: boolean;
      canonicalAddress: string;
    };

    expect(body.success).toBe(true);
    expect(body.status).toBe('soon');
    expect(body.isAirdropLive).toBe(false);
    expect(body.canonicalAddress).toBe(`0:${TEST_HASH_HEX}`);
  });

  it('strictly rejects nonce replay attack (atomic single-use invariant)', async () => {
    // Attempt to reuse user1ActiveNonce which was already consumed in the previous test
    const replayedProof = createSignedProof(user1ActiveNonce);

    const replayRes = await app.request(
      '/wallet/connect',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: validBounceable,
          walletProvider: 'tonkeeper',
          publicKey: publicKeyHex,
          tonProof: replayedProof,
        }),
      },
      env,
    );

    expect(replayRes.status).toBe(400);
    const body = (await replayRes.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NONCE_REPLAY_DETECTED');
  });

  it('strictly rejects Sybil farming attempts (one-wallet-per-account invariant)', async () => {
    // User 2 attempts to connect the SAME wallet address already connected by User 1
    const res = await app.request(
      '/wallet/connect',
      {
        method: 'POST',
        headers: {
          Cookie: testUser2.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: validBounceable,
          walletProvider: 'telegram_wallet',
        }),
      },
      env,
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('WALLET_ALREADY_LINKED');
    expect(body.error.message).toContain('Sybil');
  });

  it('retrieves wallet status and transparent airdrop calculation in soon phase', async () => {
    const res = await app.request(
      '/wallet/status',
      {
        method: 'GET',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      wallet: { canonicalAddress: string; walletProvider: string };
      airdrop: {
        phase: string;
        isLive: boolean;
        statusText: string;
        allocation: { totalAirdropPoints: number; walletBonus: number };
      };
    };

    expect(body.connected).toBe(true);
    expect(body.wallet.canonicalAddress).toBe(`0:${TEST_HASH_HEX}`);
    expect(body.airdrop.isLive).toBe(false);
    expect(body.airdrop.phase).toBe('preparation_soon');
    expect(body.airdrop.statusText).toContain('SOON');
    expect(body.airdrop.allocation.walletBonus).toBe(1000);
  });

  it('handles airdrop claim flow and enforces claim idempotency', async () => {
    const requestId1 = crypto.randomUUID();
    const claimRes1 = await app.request(
      '/airdrop/claim',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seasonId: 'season_genesis_1',
          requestId: requestId1,
        }),
      },
      env,
    );

    expect(claimRes1.status).toBe(200);
    const body1 = (await claimRes1.json()) as {
      success: boolean;
      seasonId: string;
      claimedPoints: number;
      tier: string;
    };
    expect(body1.success).toBe(true);
    expect(body1.seasonId).toBe('season_genesis_1');
    expect(body1.claimedPoints).toBeGreaterThan(0);

    // Duplicate claim attempt for the same season (Idempotency / Anti-Double-Spend)
    const requestId2 = crypto.randomUUID();
    const claimRes2 = await app.request(
      '/airdrop/claim',
      {
        method: 'POST',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seasonId: 'season_genesis_1',
          requestId: requestId2,
        }),
      },
      env,
    );

    expect(claimRes2.status).toBe(409);
    const body2 = (await claimRes2.json()) as { error: { code: string } };
    expect(body2.error.code).toBe('ALREADY_CLAIMED');
  });

  it('disconnects wallet successfully when unlocked', async () => {
    const res = await app.request(
      '/wallet/disconnect',
      {
        method: 'DELETE',
        headers: {
          Cookie: testUser1.cookie,
          Origin: origin,
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    // Verify it is disconnected in status
    const statusRes = await app.request(
      '/wallet/status',
      { method: 'GET', headers: { Cookie: testUser1.cookie, Origin: origin } },
      env,
    );
    const statusBody = (await statusRes.json()) as { connected: boolean; wallet: null };
    expect(statusBody.connected).toBe(false);
    expect(statusBody.wallet).toBeNull();
  });

  it('serves global public airdrop summary with transparent policies', async () => {
    const res = await app.request(
      '/airdrop/summary',
      {
        method: 'GET',
        headers: { Origin: origin },
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      tokenSymbol: string;
      chain: string;
      isLive: boolean;
      transparencyPolicy: { antiP2W: boolean; fairLaunch: boolean };
    };

    expect(body.tokenSymbol).toBe('$EMPIRE');
    expect(body.chain).toContain('TON');
    expect(body.isLive).toBe(false);
    expect(body.transparencyPolicy.antiP2W).toBe(true);
    expect(body.transparencyPolicy.fairLaunch).toBe(true);
  });
});
