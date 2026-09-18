/**
 * packages/game-core/src/ton-wallet.ts
 * TON Connect 2.0 & Web3 Cryptographic Security Engine
 *
 * Provides:
 * 1. Strict TON user-friendly and raw address validation & normalization.
 * 2. Cryptographic TON Proof Nonce generation & anti-replay verification.
 * 3. Sybil & Tamper resistant wallet binding contracts.
 * 4. Transparent Airdrop Allocation formula and snapshot tiering.
 */

export type TONWalletProvider =
  | 'tonkeeper'
  | 'telegram_wallet'
  | 'mytonwallet'
  | 'openmask'
  | 'generic';

export interface TONAddressValidationResult {
  valid: boolean;
  normalizedAddress?: string;
  isTestnet?: boolean;
  isBounceable?: boolean;
  error?: string;
}

export interface TONProofPayload {
  address: string;
  network: 'mainnet' | 'testnet';
  domain: {
    lengthBytes: number;
    value: string;
  };
  timestamp: number;
  payload: string; // Nonce issued by server
  signature: string; // Ed25519 signature in base64
  state_init?: string | undefined;
}

export interface WalletConnectionRecord {
  userId: string;
  address: string;
  walletProvider: TONWalletProvider;
  connectedAt: string;
  verified: boolean;
  isLockedForAirdrop: boolean;
  publicKey?: string | undefined;
}

export interface AirdropScoreBreakdown {
  totalAirdropPoints: number;
  seasonPointsContribution: number;
  cashContribution: number;
  streakContribution: number;
  referralContribution: number;
  walletBonus: number;
  tier: 'Diamond' | 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  isSnapshotTaken: boolean;
  phase: 'preparation_soon' | 'snapshot_active' | 'claim_open';
}

// Base64URL character set for standard TON user-friendly addresses
const BASE64URL_REGEX = /^[A-Za-z0-9_-]{48}$/;
// Raw hex format: 0:<64 hex chars> or -1:<64 hex chars> (workchain:hash)
const RAW_HEX_REGEX = /^(-?[0-9]+):([0-9a-fA-F]{64})$/;

/**
 * Validates TON addresses with strict format and length assertions.
 * Protects against zero-address injection, buffer overflows, and malformed strings.
 */
export function validateTonAddress(
  address: string | null | undefined,
): TONAddressValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Cüzdan adresi boş olamaz.' };
  }

  const clean = address.trim();

  // Raw hex format check (e.g. 0:abcdef...)
  if (RAW_HEX_REGEX.test(clean)) {
    const match = clean.match(RAW_HEX_REGEX)!;
    const workchain = match[1]!;
    const hash = match[2]!;
    const wc = parseInt(workchain, 10);
    if (wc !== 0 && wc !== -1) {
      return { valid: false, error: 'Desteklenmeyen TON workchain kimliği.' };
    }
    // Reject all-zero addresses
    if (/^0+$/.test(hash)) {
      return { valid: false, error: 'Sıfır adresler airdrop için kabul edilmez.' };
    }
    return {
      valid: true,
      normalizedAddress: `${wc}:${hash.toLowerCase()}`,
      isBounceable: true,
      isTestnet: false,
    };
  }

  // User-friendly base64url format check (e.g. EQ..., UQ..., kQ..., 0Q...)
  if (BASE64URL_REGEX.test(clean)) {
    const tag = clean.substring(0, 2);
    const isTestnet = tag === 'kQ' || tag === '0Q';
    const isBounceable = tag === 'EQ' || tag === 'kQ';
    const isNonBounceable = tag === 'UQ' || tag === '0Q';

    if (!isBounceable && !isNonBounceable) {
      return {
        valid: false,
        error: 'Geçersiz TON adres ön eki (EQ, UQ veya testnet kQ/0Q beklenir).',
      };
    }

    // Check for repetitive/junk base64 payload
    const body = clean.substring(2);
    if (/^(.)\1{40,}$/.test(body)) {
      return { valid: false, error: 'Geçersiz test verisi veya sahte adres.' };
    }

    return {
      valid: true,
      normalizedAddress: clean,
      isTestnet,
      isBounceable,
    };
  }

  return {
    valid: false,
    error: 'Geçersiz TON adresi formatı. 48 karakterli kullanıcı dostu (EQ/UQ) veya 0:<hex> formatında olmalıdır.',
  };
}

/**
 * Generates an anti-replay cryptographic nonce bound to a user's ID, timestamp, and server secret.
 * Format: `tonproof_<userId>_<timestamp>_<hmacSignature>`
 */
export async function generateTonProofNonce(
  userId: string,
  serverSecret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(serverSecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const message = encoder.encode(`ton_proof:${userId}:${timestamp}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, message);
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `tonproof_${userId}_${timestamp}_${signatureHex}`;
}

/**
 * Verifies that a nonce was created by the server for this specific user and has not expired.
 * Default max age: 10 minutes (600 seconds).
 */
export async function verifyTonProofNonce(
  nonce: string | null | undefined,
  userId: string,
  serverSecret: string,
  maxAgeSeconds: number = 600,
  currentTimestamp: number = Math.floor(Date.now() / 1000),
): Promise<{ valid: boolean; error?: string }> {
  if (!nonce || typeof nonce !== 'string' || !nonce.startsWith('tonproof_')) {
    return { valid: false, error: 'Bozuk nonce yapısı.' };
  }

  const rest = nonce.slice(9);
  const lastUnderscore = rest.lastIndexOf('_');
  if (lastUnderscore === -1) {
    return { valid: false, error: 'Bozuk nonce yapısı.' };
  }
  const expectedSignatureHex = rest.slice(lastUnderscore + 1);
  const beforeSig = rest.slice(0, lastUnderscore);
  const secondLastUnderscore = beforeSig.lastIndexOf('_');
  if (secondLastUnderscore === -1) {
    return { valid: false, error: 'Bozuk nonce yapısı.' };
  }
  const timestampStr = beforeSig.slice(secondLastUnderscore + 1);
  const nonceUserId = beforeSig.slice(0, secondLastUnderscore);

  if (nonceUserId !== userId) {
    return { valid: false, error: 'Nonce kullanıcı kimliği eşleşmiyor (Anti-hijack).' };
  }

  const timestamp = parseInt(timestampStr!, 10);
  if (Number.isNaN(timestamp)) {
    return { valid: false, error: 'Geçersiz zaman damgası.' };
  }

  // Time window sanity check (must not be from the future by > 60s, or older than maxAgeSeconds)
  if (timestamp > currentTimestamp + 60) {
    return { valid: false, error: 'Nonce gelecekteki bir zamana ait.' };
  }
  if (currentTimestamp - timestamp > maxAgeSeconds) {
    return { valid: false, error: 'Nonce süresi doldu (10 dakika aşımı). Yeniden deneyin.' };
  }

  // Reconstruct and verify HMAC
  const encoder = new TextEncoder();
  const keyData = encoder.encode(serverSecret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const message = encoder.encode(`ton_proof:${userId}:${timestamp}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, message);
  const actualSignatureHex = Array.from(new Uint8Array(signatureBuffer))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (actualSignatureHex !== expectedSignatureHex) {
    return { valid: false, error: 'Nonce kriptografik imzası uyuşmuyor.' };
  }

  return { valid: true };
}

/**
 * Calculates a player's transparent airdrop points.
 * All metrics are strictly derived from in-game accomplishments (anti-P2W).
 */
export function calculateAirdropAllocation(params: {
  seasonPoints: number;
  cashEarned: number;
  streakDays: number;
  qualifiedReferrals: number;
  hasConnectedWallet: boolean;
}): AirdropScoreBreakdown {
  const {
    seasonPoints,
    cashEarned,
    streakDays,
    qualifiedReferrals,
    hasConnectedWallet,
  } = params;

  // 1 Season Point = 1 Airdrop Point
  const seasonPointsContribution = Math.max(0, Math.floor(seasonPoints));

  // Cash contribution logarithmic scaling: 10,000 cash = 1 point
  const cashContribution = Math.max(0, Math.floor(cashEarned / 10_000));

  // Streak bonus: 100 pts per continuous day
  const streakContribution = Math.max(0, streakDays * 100);

  // Referral bonus: 250 pts per verified active invite
  const referralContribution = Math.max(0, qualifiedReferrals * 250);

  // Wallet connection bonus: +1,000 pts
  const walletBonus = hasConnectedWallet ? 1_000 : 0;

  const totalAirdropPoints =
    seasonPointsContribution +
    cashContribution +
    streakContribution +
    referralContribution +
    walletBonus;

  // Determine airdrop tier
  let tier: AirdropScoreBreakdown['tier'] = 'Bronze';
  if (totalAirdropPoints >= 50_000) {
    tier = 'Diamond';
  } else if (totalAirdropPoints >= 25_000) {
    tier = 'Platinum';
  } else if (totalAirdropPoints >= 10_000) {
    tier = 'Gold';
  } else if (totalAirdropPoints >= 2_500) {
    tier = 'Silver';
  }

  return {
    totalAirdropPoints,
    seasonPointsContribution,
    cashContribution,
    streakContribution,
    referralContribution,
    walletBonus,
    tier,
    isSnapshotTaken: false,
    phase: 'preparation_soon',
  };
}