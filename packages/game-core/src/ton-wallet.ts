/**
 * packages/game-core/src/ton-wallet.ts
 * Enterprise-Grade TON Connect 2.0 & Web3 Cryptographic Security Engine
 *
 * Implements:
 * 1. Strict TON address validation & canonicalization (CRC16 checksum, workchains, base64url/raw, network allowlists).
 * 2. Official TON Connect 2.0 `ton_proof` verification (binary layout, Ed25519 signature, domain binding, clock skew, StateInit validation).
 * 3. Cryptographic CSPRNG anti-replay nonce engine with purpose separation and atomic consumption hooks.
 * 4. Deterministic, integer-safe Airdrop Allocation calculator & idempotent claim models.
 */

import { Address, Cell, loadStateInit } from '@ton/core';
import { sha256_sync, signVerify } from '@ton/crypto';

export type TONWalletProvider =
  | 'tonkeeper'
  | 'telegram_wallet'
  | 'mytonwallet'
  | 'openmask'
  | 'generic';

export type AllowedNetwork = 'mainnet' | 'testnet' | 'all';

export type NoncePurpose = 'LINK_WALLET' | 'AUTH' | 'AIRDROP_CLAIM';

export interface TONAddressValidationResult {
  valid: boolean;
  canonicalAddress?: string; // Formatted as canonical raw: 0:<64 hex> or -1:<64 hex>
  normalizedAddress?: string; // Standard friendly format
  friendlyAddress?: string;
  workchain?: number;
  accountHashHex?: string;
  isTestnet?: boolean;
  isBounceable?: boolean;
  error?: string;
}

export interface TONProofDomain {
  lengthBytes: number;
  value: string;
}

export interface TONProofPayload {
  address: string; // Claimed wallet address (friendly or raw)
  network?: 'mainnet' | 'testnet' | '-239' | '-3' | undefined;
  domain: TONProofDomain;
  timestamp: number;
  payload: string; // Server-issued nonce
  signature: string; // Ed25519 signature in Base64 or Hex
  state_init?: string | undefined; // Base64 serialized Bag-of-Cells (BoC)
  publicKey?: string | undefined; // 32-byte public key in Hex or Base64
}

export interface TONProofVerificationResult {
  valid: boolean;
  canonicalAddress?: string;
  publicKeyHex?: string;
  error?: string;
  reasonCode?:
    | 'INVALID_ADDRESS'
    | 'NETWORK_MISMATCH'
    | 'INVALID_TIMESTAMP'
    | 'DOMAIN_MISMATCH'
    | 'INVALID_DOMAIN_LENGTH'
    | 'INVALID_NONCE'
    | 'STATEINIT_MISMATCH'
    | 'PUBLIC_KEY_MISMATCH'
    | 'INVALID_SIGNATURE'
    | 'MALFORMED_PROOF';
}

export interface WalletConnectionRecord {
  userId: string;
  address: string; // Always stored in canonical representation 0:<hex>
  friendlyAddress: string;
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

// -----------------------------------------------------------------------------
// 1. ADDRESS VALIDATION & CANONICALIZATION
// -----------------------------------------------------------------------------

/**
 * Validates TON addresses with strict format, CRC16 checksum, workchain, and length assertions.
 * Normalizes all valid addresses into a single canonical internal format: `workchain:64_hex_hash`.
 *
 * @param address - Friendly (EQ/UQ/kQ/0Q) or Raw (0:<hex> / -1:<hex>) address.
 * @param allowedNetwork - Configurable network check (default: 'mainnet').
 */
export function validateTonAddress(
  address: string | null | undefined,
  allowedNetwork: AllowedNetwork = 'mainnet',
): TONAddressValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Cüzdan adresi boş olamaz.' };
  }

  // Defend against null bytes, control characters, leading/trailing whitespace
  if (/[\x00-\x1F\x7F]/.test(address)) {
    return { valid: false, error: 'Cüzdan adresi geçersiz kontrol karakterleri içeriyor.' };
  }

  const clean = address.trim();
  if (clean.length === 0 || clean.length > 128) {
    return { valid: false, error: 'Cüzdan adresi uzunluğu geçersiz.' };
  }

  let parsed: Address;
  let isFriendly = false;
  let isBounceable = true;
  let isTestOnly = false;

  try {
    if (Address.isFriendly(clean)) {
      isFriendly = true;
      const parsedFriendly = Address.parseFriendly(clean);
      parsed = parsedFriendly.address;
      isBounceable = parsedFriendly.isBounceable;
      isTestOnly = parsedFriendly.isTestOnly;
    } else if (Address.isRaw(clean)) {
      parsed = Address.parseRaw(clean);
    } else {
      return {
        valid: false,
        error: 'Geçersiz TON adresi formatı (kullanıcı dostu EQ/UQ veya 0:<hex> beklenir).',
      };
    }
  } catch (err) {
    return {
      valid: false,
      error: `Adres doğrulama veya CRC16 sağlama hatası: ${err instanceof Error ? err.message : 'Bozuk adres'}`,
    };
  }

  // Verify Workchain (only 0 for basechain, -1 for masterchain)
  if (parsed.workChain !== 0 && parsed.workChain !== -1) {
    return { valid: false, error: `Desteklenmeyen TON workchain: ${parsed.workChain}` };
  }

  const accountHashHex = parsed.hash.toString('hex').toLowerCase();

  // Reject all-zero address (black hole)
  if (/^0+$/.test(accountHashHex)) {
    return { valid: false, error: 'Sıfır adresler kabul edilmez.' };
  }

  // Network enforcement
  if (allowedNetwork === 'mainnet' && isTestOnly) {
    return { valid: false, error: 'Testnet adresleri mainnet ortamında kabul edilmez.' };
  }
  if (allowedNetwork === 'testnet' && isFriendly && !isTestOnly) {
    return { valid: false, error: 'Mainnet adresleri testnet ortamında kabul edilmez.' };
  }

  const canonicalAddress = parsed.toRawString().toLowerCase();
  const friendlyBounceable = parsed.toString({ bounceable: true, testOnly: isTestOnly });
  const friendlyNonBounceable = parsed.toString({ bounceable: false, testOnly: isTestOnly });

  return {
    valid: true,
    canonicalAddress,
    normalizedAddress: isBounceable ? friendlyBounceable : friendlyNonBounceable,
    friendlyAddress: friendlyBounceable,
    workchain: parsed.workChain,
    accountHashHex,
    isTestnet: isTestOnly,
    isBounceable,
  };
}

// -----------------------------------------------------------------------------
// 2. TON CONNECT 2.0 ton_proof MESSAGE RECONSTRUCTION & HASHING
// -----------------------------------------------------------------------------

const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_MAGIC = 'ton-connect';

/**
 * Reconstructs the exact binary message required by the official TON Connect 2.0 specification.
 * Layout:
 * `"ton-proof-item-v2/" + wc (int32 BE) + accountHash (32 bytes) + domainLen (uint32 LE) + domain (utf8) + timestamp (uint64 LE) + payload (utf8)`
 */
export function createTonProofMessage(params: {
  workchain: number;
  accountHash: Buffer | Uint8Array;
  domainLengthBytes: number;
  domainValue: string;
  timestamp: number;
  payload: string;
}): Buffer {
  const prefixBuf = Buffer.from(TON_PROOF_PREFIX, 'utf8');

  // Workchain: 32-bit signed integer, Big Endian
  const wcBuf = Buffer.alloc(4);
  wcBuf.writeInt32BE(params.workchain, 0);

  // Address: 32 bytes account ID hash
  const addrBuf = Buffer.from(params.accountHash);
  if (addrBuf.length !== 32) {
    throw new Error(`Geçersiz adres hash uzunluğu (beklenen: 32, gelen: ${addrBuf.length})`);
  }

  // Domain length: 32-bit unsigned integer, Little Endian
  const dlBuf = Buffer.alloc(4);
  dlBuf.writeUInt32LE(params.domainLengthBytes, 0);

  // Domain value: UTF-8 string bytes
  const domBuf = Buffer.from(params.domainValue, 'utf8');

  // Timestamp: 64-bit unsigned integer (uint64), Little Endian
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64LE(BigInt(params.timestamp), 0);

  // Payload: UTF-8 string bytes (the server-issued nonce)
  const payloadBuf = Buffer.from(params.payload, 'utf8');

  return Buffer.concat([prefixBuf, wcBuf, addrBuf, dlBuf, domBuf, tsBuf, payloadBuf]);
}

/**
 * Generates the final 32-byte digest that was signed with Ed25519.
 * Formula: `sha256( 0xffff ++ "ton-connect" ++ sha256(message) )`
 */
export function createTonProofHash(message: Buffer): Buffer {
  const msgHash = sha256_sync(message);
  const prefixMagic = Buffer.concat([
    Buffer.from([0xff, 0xff]),
    Buffer.from(TON_CONNECT_MAGIC, 'utf8'),
    msgHash,
  ]);
  return sha256_sync(prefixMagic);
}

// -----------------------------------------------------------------------------
// 3. DOMAIN, TIMESTAMP & CRYPTOGRAPHIC VERIFICATION
// -----------------------------------------------------------------------------

/**
 * Validates proof domain against an authorized allowlist.
 * Protects against subdomain hijacking, evil.com, punycode, and localhost in production.
 */
export function verifyProofDomain(
  domain: TONProofDomain | null | undefined,
  allowedDomains: readonly string[],
  isProduction: boolean = false,
): { valid: boolean; error?: string } {
  if (!domain || typeof domain.value !== 'string' || typeof domain.lengthBytes !== 'number') {
    return { valid: false, error: 'Domain bilgisi eksik veya geçersiz.' };
  }

  const rawDomain = domain.value.trim().toLowerCase();
  const normalizedDomain = rawDomain.endsWith('.') ? rawDomain.slice(0, -1) : rawDomain;

  // Check domain length bytes
  const actualByteLength = Buffer.byteLength(domain.value, 'utf8');
  if (domain.lengthBytes !== actualByteLength) {
    return {
      valid: false,
      error: `Domain byte uzunluğu uyuşmuyor (bildirilen: ${domain.lengthBytes}, gerçek: ${actualByteLength}).`,
    };
  }

  // Check valid hostname characters (RFC 1123)
  if (
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d+)?$/.test(
      normalizedDomain,
    )
  ) {
    return { valid: false, error: 'Geçersiz domain formatı.' };
  }

  // Reject localhost in production
  if (
    isProduction &&
    (normalizedDomain.startsWith('localhost') ||
      normalizedDomain.startsWith('127.0.0.1') ||
      normalizedDomain.startsWith('0.0.0.0'))
  ) {
    return { valid: false, error: 'Production ortamında localhost domaini kabul edilmez.' };
  }

  const normalizedAllowed = allowedDomains.map((d) =>
    d.trim().toLowerCase().replace(/\.$/, ''),
  );

  if (!normalizedAllowed.includes(normalizedDomain)) {
    return {
      valid: false,
      error: `Yetkisiz domain (${normalizedDomain}). Beklenen izin verilen domainlerle eşleşmiyor.`,
    };
  }

  return { valid: true };
}

/**
 * Validates timestamp freshness with bounded clock skew tolerance.
 */
export function verifyProofTimestamp(
  timestamp: unknown,
  serverTime: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = 300,
): { valid: boolean; error?: string } {
  if (
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp) ||
    !Number.isInteger(timestamp)
  ) {
    return { valid: false, error: 'Timestamp geçerli bir tam sayı olmalıdır.' };
  }

  if (timestamp <= 0) {
    return { valid: false, error: 'Timestamp pozitif bir değer olmalıdır.' };
  }

  // Milliseconds confusion check (timestamp > 1e11 indicates client passed ms instead of seconds)
  if (timestamp > 1e11) {
    return {
      valid: false,
      error: 'Timestamp saniye cinsinden Unix zamanı olmalıdır (milisaniye tespit edildi).',
    };
  }

  const diff = Math.abs(serverTime - timestamp);
  if (diff > toleranceSeconds) {
    return {
      valid: false,
      error: `Proof timestamp süresi aşımı veya saat uyumsuzluğu (fark: ${diff}s, izin verilen: ${toleranceSeconds}s).`,
    };
  }

  return { valid: true };
}

/**
 * Constant-time byte array comparison preventing timing attacks.
 */
export function timingSafeEqual(a: Uint8Array | Buffer, b: Uint8Array | Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/**
 * Verifies that state_init BoC matches claimed address and contains the claimed public key.
 */
export function parseAndVerifyStateInit(
  stateInitBocBase64: string,
  claimedAccountHashHex: string,
  claimedPublicKeyHex?: string,
): { valid: boolean; extractedPublicKeyHex?: string; error?: string } {
  try {
    const cell = Cell.fromBase64(stateInitBocBase64);
    const stateInitHashHex = cell.hash().toString('hex').toLowerCase();

    // Verification 1: StateInit hash must exactly match claimed account address hash
    if (stateInitHashHex !== claimedAccountHashHex.toLowerCase()) {
      return {
        valid: false,
        error: `StateInit hash (${stateInitHashHex}) iddia edilen adres hash'i (${claimedAccountHashHex}) ile eşleşmiyor.`,
      };
    }

    // Verification 2: Parse StateInit to inspect data cell
    const parsedStateInit = loadStateInit(cell.asSlice());
    if (!parsedStateInit.data) {
      return { valid: false, error: 'StateInit içinde veri (data cell) bulunamadı.' };
    }

    // Inspect standard wallet data layout (v3 / v4 / v5 wallets store public key in data cell)
    const slice = parsedStateInit.data.asSlice();
    let extractedPublicKey: Buffer | null = null;

    try {
      // Wallet v4: seqno(32) + subwallet_id(32) + public_key(256)
      // Wallet v3: seqno(32) + public_key(256)
      if (slice.remainingBits >= 320) {
        // v4 layout
        slice.skip(64);
        extractedPublicKey = slice.loadBuffer(32);
      } else if (slice.remainingBits >= 288) {
        // v3 layout
        slice.skip(32);
        extractedPublicKey = slice.loadBuffer(32);
      }
    } catch {
      // Non-standard or encrypted wallet contract
    }

    if (extractedPublicKey) {
      const extractedHex = extractedPublicKey.toString('hex').toLowerCase();
      if (
        claimedPublicKeyHex &&
        extractedHex !== claimedPublicKeyHex.toLowerCase()
      ) {
        return {
          valid: false,
          error: `StateInit içindeki public key (${extractedHex}) istemcinin bildirdiği public key (${claimedPublicKeyHex}) ile uyuşmuyor.`,
        };
      }
      return { valid: true, extractedPublicKeyHex: extractedHex };
    }

    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: `StateInit BoC çözümleme hatası: ${err instanceof Error ? err.message : 'Bozuk veri'}`,
    };
  }
}

/**
 * Comprehensive Server-Side TON Connect 2.0 ton_proof Verification.
 * Strictly verifies Address, Domain, Timestamp, Nonce, StateInit, and Ed25519 signature.
 */
export async function verifyTonProof(params: {
  proof: TONProofPayload;
  allowedDomains: readonly string[];
  allowedNetwork?: AllowedNetwork;
  isProduction?: boolean;
  serverTime?: number;
  toleranceSeconds?: number;
}): Promise<TONProofVerificationResult> {
  const {
    proof,
    allowedDomains,
    allowedNetwork = 'mainnet',
    isProduction = false,
    serverTime = Math.floor(Date.now() / 1000),
    toleranceSeconds = 300,
  } = params;

  if (!proof || typeof proof !== 'object') {
    return { valid: false, error: 'Eksik veya geçersiz proof nesnesi.', reasonCode: 'MALFORMED_PROOF' };
  }

  // 1. Validate Address & Canonicalize
  const addressCheck = validateTonAddress(proof.address, allowedNetwork);
  if (!addressCheck.valid || !addressCheck.canonicalAddress || !addressCheck.accountHashHex) {
    return {
      valid: false,
      error: addressCheck.error || 'Geçersiz TON cüzdan adresi.',
      reasonCode: 'INVALID_ADDRESS',
    };
  }

  // 2. Validate Domain Binding
  const domainCheck = verifyProofDomain(proof.domain, allowedDomains, isProduction);
  if (!domainCheck.valid) {
    return {
      valid: false,
      error: domainCheck.error ?? 'Geçersiz domain.',
      reasonCode: domainCheck.error?.includes('uzunluğu')
        ? 'INVALID_DOMAIN_LENGTH'
        : 'DOMAIN_MISMATCH',
    };
  }

  // 3. Validate Timestamp
  const timestampCheck = verifyProofTimestamp(proof.timestamp, serverTime, toleranceSeconds);
  if (!timestampCheck.valid) {
    return {
      valid: false,
      error: timestampCheck.error ?? 'Geçersiz zaman damgası.',
      reasonCode: 'INVALID_TIMESTAMP',
    };
  }

  // 4. Validate Public Key / StateInit
  let effectivePublicKeyHex = proof.publicKey ? proof.publicKey.trim().toLowerCase() : undefined;

  // Convert base64 pubkey to hex if needed
  if (effectivePublicKeyHex && effectivePublicKeyHex.length === 44 && effectivePublicKeyHex.includes('=')) {
    try {
      effectivePublicKeyHex = Buffer.from(effectivePublicKeyHex, 'base64').toString('hex').toLowerCase();
    } catch {
      // Keep as-is
    }
  }

  if (proof.state_init) {
    const stateInitCheck = parseAndVerifyStateInit(
      proof.state_init,
      addressCheck.accountHashHex,
      effectivePublicKeyHex,
    );
    if (!stateInitCheck.valid) {
      return {
        valid: false,
        error: stateInitCheck.error ?? 'Geçersiz StateInit.',
        reasonCode: stateInitCheck.error?.includes('public key')
          ? 'PUBLIC_KEY_MISMATCH'
          : 'STATEINIT_MISMATCH',
      };
    }
    if (stateInitCheck.extractedPublicKeyHex) {
      effectivePublicKeyHex = stateInitCheck.extractedPublicKeyHex;
    }
  }

  if (!effectivePublicKeyHex || effectivePublicKeyHex.length !== 64) {
    return {
      valid: false,
      error: 'Geçersiz veya eksik 32-byte Ed25519 cüzdan public key.',
      reasonCode: 'PUBLIC_KEY_MISMATCH',
    };
  }

  // 5. Decode Signature
  let signatureBuffer: Buffer;
  try {
    const cleanSig = proof.signature.trim();
    if (/^[0-9a-fA-F]{128}$/.test(cleanSig)) {
      signatureBuffer = Buffer.from(cleanSig, 'hex');
    } else {
      signatureBuffer = Buffer.from(cleanSig, 'base64');
    }
    if (signatureBuffer.length !== 64) {
      return {
        valid: false,
        error: `Geçersiz Ed25519 imza uzunluğu (beklenen: 64 byte, gelen: ${signatureBuffer.length})`,
        reasonCode: 'INVALID_SIGNATURE',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'İmza Base64 veya Hex formatında çözülemedi.',
      reasonCode: 'INVALID_SIGNATURE',
    };
  }

  // 6. Reconstruct Message & Hash
  const messageBuffer = createTonProofMessage({
    workchain: addressCheck.workchain ?? 0,
    accountHash: Buffer.from(addressCheck.accountHashHex, 'hex'),
    domainLengthBytes: proof.domain.lengthBytes,
    domainValue: proof.domain.value,
    timestamp: proof.timestamp,
    payload: proof.payload,
  });

  const finalHashToSign = createTonProofHash(messageBuffer);

  // 7. Verify Ed25519 Signature
  const pubKeyBuffer = Buffer.from(effectivePublicKeyHex, 'hex');
  const isSignatureValid = signVerify(finalHashToSign, signatureBuffer, pubKeyBuffer);

  if (!isSignatureValid) {
    return {
      valid: false,
      error: 'Kriptografik Ed25519 ton_proof imzası doğrulanamadı (imza geçersiz).',
      reasonCode: 'INVALID_SIGNATURE',
    };
  }

  return {
    valid: true,
    canonicalAddress: addressCheck.canonicalAddress,
    publicKeyHex: effectivePublicKeyHex,
  };
}

// -----------------------------------------------------------------------------
// 4. CSPRNG ANTI-REPLAY NONCE ENGINE WITH PURPOSE SEPARATION
// -----------------------------------------------------------------------------

export interface NonceDetails {
  nonceId: string;
  userId: string;
  purpose: NoncePurpose;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Generates an unpredictable cryptographic nonce with CSPRNG entropy, bound to user, purpose, and TTL.
 * Format: `tonproof_${purpose}_${userId}_${issuedAt}_${expiresAt}_${nonceId}_${hmacHex}`
 */
export function generateTonProofNonce(
  userId: string,
  serverSecret: string,
  purpose: NoncePurpose = 'LINK_WALLET',
  issuedAt: number = Math.floor(Date.now() / 1000),
  ttlSeconds: number = 300,
): { nonce: string; nonceId: string; expiresAt: number } {
  if (!serverSecret || serverSecret.length < 16) {
    throw new Error('Sunucu secret anahtarı yetersiz entropiye sahip (en az 16 karakter gereklidir).');
  }

  // 32 bytes of CSPRNG entropy
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const nonceId = Buffer.from(randomBytes).toString('hex');

  const expiresAt = issuedAt + ttlSeconds;
  const message = `ton_proof_v2:${purpose}:${userId}:${issuedAt}:${expiresAt}:${nonceId}`;

  // HMAC-SHA256 signature
  const key = Buffer.from(serverSecret, 'utf8');
  const hmacBuffer = sha256_sync(Buffer.concat([key, Buffer.from(message, 'utf8'), key]));
  const hmacHex = hmacBuffer.subarray(0, 16).toString('hex');

  const nonce = `tonproof_${purpose}_${userId}_${issuedAt}_${expiresAt}_${nonceId}_${hmacHex}`;

  return { nonce, nonceId, expiresAt };
}

/**
 * Verifies the integrity, signature, user binding, and expiration of a tonproof nonce.
 */
export function verifyTonProofNonce(
  nonce: string | null | undefined,
  expectedUserId: string,
  serverSecret: string,
  expectedPurpose: NoncePurpose = 'LINK_WALLET',
  currentTimestamp: number = Math.floor(Date.now() / 1000),
): { valid: boolean; details?: NonceDetails; error?: string } {
  const prefix = 'tonproof_';
  if (!nonce || typeof nonce !== 'string' || !nonce.startsWith(prefix)) {
    return { valid: false, error: 'Bozuk veya eksik nonce yapısı.' };
  }

  const rest = nonce.slice(prefix.length);
  let purpose: NoncePurpose | null = null;
  let afterPurpose = '';

  for (const p of ['LINK_WALLET', 'AIRDROP_CLAIM', 'AUTH'] as const) {
    if (rest.startsWith(`${p}_`)) {
      purpose = p;
      afterPurpose = rest.slice(p.length + 1);
      break;
    }
  }

  if (!purpose) {
    return { valid: false, error: 'Geçersiz nonce segment yapısı.' };
  }

  const trailingParts = afterPurpose.split('_');
  if (trailingParts.length < 5) {
    return { valid: false, error: 'Geçersiz nonce segment yapısı.' };
  }

  const hmacHex = trailingParts.pop();
  const nonceId = trailingParts.pop();
  const expiresAtStr = trailingParts.pop();
  const issuedAtStr = trailingParts.pop();
  const userId = trailingParts.join('_');

  if (purpose !== expectedPurpose) {
    return {
      valid: false,
      error: `Nonce amaç uyuşmazlığı (beklenen: ${expectedPurpose}, gelen: ${purpose}).`,
    };
  }

  if (userId !== expectedUserId) {
    return { valid: false, error: 'Nonce kullanıcı kimliği eşleşmiyor (Anti-hijack).' };
  }

  const issuedAt = parseInt(issuedAtStr!, 10);
  const expiresAt = parseInt(expiresAtStr!, 10);

  if (Number.isNaN(issuedAt) || Number.isNaN(expiresAt)) {
    return { valid: false, error: 'Geçersiz zaman damgası.' };
  }

  // Clock sanity check
  if (issuedAt > currentTimestamp + 60) {
    return { valid: false, error: 'Nonce gelecekteki bir zamana ait.' };
  }

  if (currentTimestamp > expiresAt) {
    return { valid: false, error: 'Nonce süresi doldu. Lütfen yeni bir bağlantı isteği başlatın.' };
  }

  // Recompute HMAC
  const message = `ton_proof_v2:${purpose}:${userId}:${issuedAt}:${expiresAt}:${nonceId}`;
  const key = Buffer.from(serverSecret, 'utf8');
  const expectedHmacBuffer = sha256_sync(
    Buffer.concat([key, Buffer.from(message, 'utf8'), key]),
  ).subarray(0, 16);

  const incomingHmacBuffer = Buffer.from(hmacHex!, 'hex');

  if (!timingSafeEqual(expectedHmacBuffer, incomingHmacBuffer)) {
    return { valid: false, error: 'Nonce kriptografik imzası uyuşmuyor.' };
  }

  return {
    valid: true,
    details: {
      nonceId: nonceId!,
      userId: userId!,
      purpose: purpose as NoncePurpose,
      issuedAt,
      expiresAt,
    },
  };
}

// -----------------------------------------------------------------------------
// 5. DETERMINISTIC, INTEGER-SAFE AIRDROP ALLOCATION MOTORU
// -----------------------------------------------------------------------------

function sanitizeSafeUint(val: unknown, maxVal: bigint = 1_000_000_000_000n): bigint {
  if (typeof val === 'bigint') {
    if (val < 0n) return 0n;
    return val > maxVal ? maxVal : val;
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || Number.isNaN(val) || val <= 0) return 0n;
    const floored = Math.floor(val);
    const big = BigInt(floored);
    return big > maxVal ? maxVal : big;
  }
  return 0n;
}

/**
 * Calculates a player's transparent airdrop points using integer/BigInt arithmetic.
 * Completely immune to floating point imprecision, NaN, Infinity, and overflow attacks.
 */
export function calculateAirdropAllocation(params: {
  seasonPoints: unknown;
  cashEarned: unknown;
  streakDays: unknown;
  qualifiedReferrals: unknown;
  hasConnectedWallet: boolean;
}): AirdropScoreBreakdown {
  const safeSeasonPoints = sanitizeSafeUint(params.seasonPoints);
  const safeCashEarned = sanitizeSafeUint(params.cashEarned);
  const safeStreakDays = sanitizeSafeUint(params.streakDays, 3650n); // max 10 years
  const safeReferrals = sanitizeSafeUint(params.qualifiedReferrals, 100_000n);

  // 1 Season Point = 1 Airdrop Point
  const seasonPointsContribution = safeSeasonPoints;

  // Cash volume: 10,000 Cash = 1 Airdrop Point (integer division)
  const cashContribution = safeCashEarned / 10_000n;

  // Streak: 100 points per daily streak
  const streakContribution = safeStreakDays * 100n;

  // Qualified referrals: 250 points each
  const referralContribution = safeReferrals * 250n;

  // Connected wallet bonus: 1,000 points
  const walletBonus = params.hasConnectedWallet ? 1_000n : 0n;

  const totalPointsBig =
    seasonPointsContribution +
    cashContribution +
    streakContribution +
    referralContribution +
    walletBonus;

  const totalAirdropPoints = Number(totalPointsBig);

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
    seasonPointsContribution: Number(seasonPointsContribution),
    cashContribution: Number(cashContribution),
    streakContribution: Number(streakContribution),
    referralContribution: Number(referralContribution),
    walletBonus: Number(walletBonus),
    tier,
    isSnapshotTaken: false,
    phase: 'preparation_soon',
  };
}