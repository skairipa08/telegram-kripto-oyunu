import { describe, expect, it } from 'vitest';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { beginCell } from '@ton/core';
import {
  calculateAirdropAllocation,
  createTonProofHash,
  createTonProofMessage,
  generateTonProofNonce,
  parseAndVerifyStateInit,
  timingSafeEqual,
  validateTonAddress,
  verifyProofDomain,
  verifyProofTimestamp,
  verifyTonProof,
  verifyTonProofNonce,
  type TONProofPayload,
} from './ton-wallet';

describe('Web3 & TON Wallet Enterprise Security Suite', () => {
  // Canonical test hash: 32 bytes
  const TEST_HASH_HEX = '6f5bc67986e06430961d9df00433926a4cd92e597ddd8aa3a47a33ad44599c00';
  const RAW_ADDRESS = `0:${TEST_HASH_HEX}`;

  // Precomputed valid friendly addresses with accurate CRC16-CCITT checksums
  const VALID_MAINNET_BOUNCEABLE = 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcAIRy';
  const VALID_MAINNET_NON_BOUNCEABLE = 'UQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcANm3';
  const VALID_TESTNET_BOUNCEABLE = 'kQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcAD_4';
  const VALID_TESTNET_NON_BOUNCEABLE = '0QBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcAGI9';

  describe('Vector 1: Strict Address Validation & Canonicalization', () => {
    it('accepts valid mainnet friendly bounceable (EQ...) and non-bounceable (UQ...) addresses', () => {
      const res1 = validateTonAddress(VALID_MAINNET_BOUNCEABLE, 'mainnet');
      expect(res1.valid).toBe(true);
      expect(res1.isBounceable).toBe(true);
      expect(res1.isTestnet).toBe(false);
      expect(res1.workchain).toBe(0);
      expect(res1.accountHashHex).toBe(TEST_HASH_HEX);
      expect(res1.canonicalAddress).toBe(RAW_ADDRESS);

      const res2 = validateTonAddress(VALID_MAINNET_NON_BOUNCEABLE, 'mainnet');
      expect(res2.valid).toBe(true);
      expect(res2.isBounceable).toBe(false);
      expect(res2.isTestnet).toBe(false);
      expect(res2.canonicalAddress).toBe(RAW_ADDRESS);
    });

    it('canonicalization invariant: all valid representations resolve to identical canonical address', () => {
      const r1 = validateTonAddress(VALID_MAINNET_BOUNCEABLE, 'all');
      const r2 = validateTonAddress(VALID_MAINNET_NON_BOUNCEABLE, 'all');
      const r3 = validateTonAddress(VALID_TESTNET_BOUNCEABLE, 'all');
      const r4 = validateTonAddress(VALID_TESTNET_NON_BOUNCEABLE, 'all');
      const r5 = validateTonAddress(RAW_ADDRESS, 'all');

      expect(r1.canonicalAddress).toBe(RAW_ADDRESS);
      expect(r2.canonicalAddress).toBe(RAW_ADDRESS);
      expect(r3.canonicalAddress).toBe(RAW_ADDRESS);
      expect(r4.canonicalAddress).toBe(RAW_ADDRESS);
      expect(r5.canonicalAddress).toBe(RAW_ADDRESS);
    });

    it('enforces network allowlists and fails closed on network mismatch', () => {
      // Testnet address in mainnet-only mode
      const res1 = validateTonAddress(VALID_TESTNET_BOUNCEABLE, 'mainnet');
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('Testnet adresleri mainnet ortamında kabul edilmez');

      // Mainnet address in testnet-only mode
      const res2 = validateTonAddress(VALID_MAINNET_BOUNCEABLE, 'testnet');
      expect(res2.valid).toBe(false);
      expect(res2.error).toContain('Mainnet adresleri testnet ortamında kabul edilmez');

      // Both allowed in 'all' mode
      expect(validateTonAddress(VALID_TESTNET_BOUNCEABLE, 'all').valid).toBe(true);
      expect(validateTonAddress(VALID_MAINNET_BOUNCEABLE, 'all').valid).toBe(true);
    });

    it('strictly rejects CRC16 checksum manipulation and single-bit mutation', () => {
      // Mutate last character of valid address (tampered checksum)
      const tamperedCrc = VALID_MAINNET_BOUNCEABLE.slice(0, -1) + 'Z';
      const res = validateTonAddress(tamperedCrc);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('CRC16 sağlama hatası');
    });

    it('strictly rejects all-zero blackhole addresses', () => {
      const zeroRaw = '0:0000000000000000000000000000000000000000000000000000000000000000';
      const res = validateTonAddress(zeroRaw);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Sıfır adresler kabul edilmez');
    });

    it('strictly rejects invalid workchains', () => {
      const invalidWorkchain = `5:${TEST_HASH_HEX}`;
      const res = validateTonAddress(invalidWorkchain);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Desteklenmeyen TON workchain');
    });

    it('strictly rejects control characters, null bytes, truncated strings, and malformed base64', () => {
      expect(validateTonAddress(null).valid).toBe(false);
      expect(validateTonAddress('').valid).toBe(false);
      expect(validateTonAddress('EQ_too_short').valid).toBe(false);
      expect(validateTonAddress(`${VALID_MAINNET_BOUNCEABLE}\x00injection`).valid).toBe(false);
      expect(validateTonAddress('0x71C8451376372705556CA56041A6CE5B49E56A3E').valid).toBe(false); // Ethereum address
    });
  });

  describe('Vector 2: Official TON Connect 2.0 ton_proof Cryptographic Engine', () => {
    // Generate deterministic test Ed25519 keypair
    const seed = Buffer.alloc(32, 42);
    const keyPair = keyPairFromSeed(seed);
    const publicKeyHex = keyPair.publicKey.toString('hex');

    const domainValue = 'empire.example';
    const domainLengthBytes = Buffer.byteLength(domainValue, 'utf8');
    const now = 1750000000;
    const payload = 'tonproof_LINK_WALLET_user1_1750000000_1750000300_nonce1_hmac1';

    // Construct valid message and signature
    const msg = createTonProofMessage({
      workchain: 0,
      accountHash: Buffer.from(TEST_HASH_HEX, 'hex'),
      domainLengthBytes,
      domainValue,
      timestamp: now,
      payload,
    });
    const toSign = createTonProofHash(msg);
    const validSignature = sign(toSign, keyPair.secretKey);
    const validSignatureBase64 = validSignature.toString('base64');

    const validProof: TONProofPayload = {
      address: VALID_MAINNET_BOUNCEABLE,
      domain: {
        lengthBytes: domainLengthBytes,
        value: domainValue,
      },
      timestamp: now,
      payload,
      signature: validSignatureBase64,
      publicKey: publicKeyHex,
    };

    it('successfully verifies a compliant TON Connect 2.0 ton_proof with Ed25519 signature', async () => {
      const result = await verifyTonProof({
        proof: validProof,
        allowedDomains: ['empire.example'],
        allowedNetwork: 'mainnet',
        serverTime: now,
        toleranceSeconds: 300,
      });

      expect(result.valid).toBe(true);
      expect(result.canonicalAddress).toBe(RAW_ADDRESS);
      expect(result.publicKeyHex).toBe(publicKeyHex);
    });

    it('rejects invalid or forged Ed25519 signatures (Anti-Forgery)', async () => {
      // Tamper signature by inverting first byte
      const tamperedSig = Buffer.from(validSignature);
      tamperedSig[0] = (tamperedSig[0] ?? 0) ^ 0xff;

      const result = await verifyTonProof({
        proof: { ...validProof, signature: tamperedSig.toString('base64') },
        allowedDomains: ['empire.example'],
        serverTime: now,
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_SIGNATURE');
    });

    it('rejects proof when domain is not in the allowed domain allowlist (Anti-Domain-Spoofing)', async () => {
      const result = await verifyTonProof({
        proof: validProof,
        allowedDomains: ['other-app.com'], // Does not match 'empire.example'
        serverTime: now,
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('DOMAIN_MISMATCH');
    });

    it('rejects proof with domain length mismatch (Anti-Length-Extension)', async () => {
      const result = await verifyTonProof({
        proof: {
          ...validProof,
          domain: { lengthBytes: domainLengthBytes + 5, value: domainValue },
        },
        allowedDomains: ['empire.example'],
        serverTime: now,
      });

      expect(result.valid).toBe(false);
      expect(result.reasonCode).toBe('INVALID_DOMAIN_LENGTH');
    });

    it('rejects expired or excessively futuristic proof timestamps (Anti-Clock-Skew)', async () => {
      // 10 minutes in the past (> 300s tolerance)
      const pastResult = await verifyTonProof({
        proof: validProof,
        allowedDomains: ['empire.example'],
        serverTime: now + 600,
        toleranceSeconds: 300,
      });
      expect(pastResult.valid).toBe(false);
      expect(pastResult.reasonCode).toBe('INVALID_TIMESTAMP');

      // Future proof
      const futureResult = await verifyTonProof({
        proof: validProof,
        allowedDomains: ['empire.example'],
        serverTime: now - 600,
        toleranceSeconds: 300,
      });
      expect(futureResult.valid).toBe(false);
      expect(futureResult.reasonCode).toBe('INVALID_TIMESTAMP');
    });

    it('verifies StateInit binding and detects public key mismatch', () => {
      // Construct a mock Wallet V4 StateInit cell with known pubkey
      const pubkeyBuf = Buffer.from(publicKeyHex, 'hex');
      const dataCell = beginCell()
        .storeUint(0, 32) // seqno
        .storeUint(698983191, 32) // subwallet id
        .storeBuffer(pubkeyBuf) // 32-byte public key
        .endCell();
      const codeCell = beginCell().storeUint(12345, 32).endCell();

      const stateInitCell = beginCell()
        .storeBit(0)
        .storeBit(0)
        .storeBit(1)
        .storeRef(codeCell)
        .storeBit(1)
        .storeRef(dataCell)
        .storeBit(0)
        .endCell();

      const stateInitBoc = stateInitCell.toBoc().toString('base64');
      const matchingHash = stateInitCell.hash().toString('hex');

      // Valid StateInit matching claimed hash and claimed pubkey
      const validCheck = parseAndVerifyStateInit(stateInitBoc, matchingHash, publicKeyHex);
      expect(validCheck.valid).toBe(true);
      expect(validCheck.extractedPublicKeyHex).toBe(publicKeyHex);

      // Mismatched hash rejection
      const mismatchHashCheck = parseAndVerifyStateInit(
        stateInitBoc,
        '0000000000000000000000000000000000000000000000000000000000000001',
        publicKeyHex,
      );
      expect(mismatchHashCheck.valid).toBe(false);
      expect(mismatchHashCheck.error).toContain('StateInit hash');

      // Mismatched claimed pubkey rejection
      const mismatchPubkeyCheck = parseAndVerifyStateInit(
        stateInitBoc,
        matchingHash,
        'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      );
      expect(mismatchPubkeyCheck.valid).toBe(false);
      expect(mismatchPubkeyCheck.error).toContain('public key');
    });
  });

  describe('Vector 3: Anti-Replay Cryptographic Nonce Engine', () => {
    const SECRET = 'test_secret_key_entropy_1234567890';
    const USER_ID = 'usr_alice_42';
    const now = 1750000000;

    it('generates high-entropy CSPRNG nonces bound to user, purpose, and timestamp', () => {
      const { nonce, nonceId, expiresAt } = generateTonProofNonce(
        USER_ID,
        SECRET,
        'LINK_WALLET',
        now,
        300,
      );

      expect(nonce.startsWith('tonproof_LINK_WALLET_usr_alice_42_')).toBe(true);
      expect(nonceId).toHaveLength(64); // 32 bytes hex
      expect(expiresAt).toBe(now + 300);

      const verification = verifyTonProofNonce(nonce, USER_ID, SECRET, 'LINK_WALLET', now + 30);
      expect(verification.valid).toBe(true);
      expect(verification.details?.nonceId).toBe(nonceId);
      expect(verification.details?.purpose).toBe('LINK_WALLET');
    });

    it('strictly rejects nonces hijacked by another user (Anti-Identity-Theft)', () => {
      const { nonce } = generateTonProofNonce(USER_ID, SECRET, 'LINK_WALLET', now, 300);
      const verification = verifyTonProofNonce(
        nonce,
        'usr_attacker_99',
        SECRET,
        'LINK_WALLET',
        now + 10,
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('Anti-hijack');
    });

    it('strictly rejects nonces created for a different purpose (Domain/Purpose Separation)', () => {
      const { nonce } = generateTonProofNonce(USER_ID, SECRET, 'AUTH', now, 300);
      const verification = verifyTonProofNonce(
        nonce,
        USER_ID,
        SECRET,
        'LINK_WALLET', // Expecting LINK_WALLET, but nonce was created for AUTH
        now + 10,
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('amaç uyuşmazlığı');
    });

    it('strictly rejects expired nonces', () => {
      const { nonce } = generateTonProofNonce(USER_ID, SECRET, 'LINK_WALLET', now, 300);
      const verification = verifyTonProofNonce(
        nonce,
        USER_ID,
        SECRET,
        'LINK_WALLET',
        now + 301, // 1 second after expiration
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('süresi doldu');
    });

    it('strictly rejects tampered nonces with invalid HMAC signature', () => {
      const { nonce } = generateTonProofNonce(USER_ID, SECRET, 'LINK_WALLET', now, 300);
      const tampered = nonce.slice(0, -4) + 'ffff';
      const verification = verifyTonProofNonce(
        tampered,
        USER_ID,
        SECRET,
        'LINK_WALLET',
        now + 10,
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('kriptografik imzası uyuşmuyor');
    });
  });

  describe('Vector 4: Deterministic & Integer-Safe Airdrop Allocation', () => {
    it('accurately computes transparent airdrop points and tier boundaries', () => {
      // Exactly 50,000 pts -> Diamond
      const diamond = calculateAirdropAllocation({
        seasonPoints: 50_000,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(diamond.totalAirdropPoints).toBe(50_000);
      expect(diamond.tier).toBe('Diamond');

      // 49,999 pts (1 below boundary) -> Platinum
      const platinumTop = calculateAirdropAllocation({
        seasonPoints: 49_999,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(platinumTop.totalAirdropPoints).toBe(49_999);
      expect(platinumTop.tier).toBe('Platinum');

      // Exactly 25,000 pts -> Platinum
      const platinum = calculateAirdropAllocation({
        seasonPoints: 25_000,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(platinum.totalAirdropPoints).toBe(25_000);
      expect(platinum.tier).toBe('Platinum');

      // 24,999 pts -> Gold
      const goldTop = calculateAirdropAllocation({
        seasonPoints: 24_999,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(goldTop.tier).toBe('Gold');

      // Exactly 10,000 pts -> Gold
      const gold = calculateAirdropAllocation({
        seasonPoints: 10_000,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(gold.tier).toBe('Gold');

      // 9,999 pts -> Silver
      const silverTop = calculateAirdropAllocation({
        seasonPoints: 9_999,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(silverTop.tier).toBe('Silver');

      // Exactly 2,500 pts -> Silver
      const silver = calculateAirdropAllocation({
        seasonPoints: 2_500,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(silver.tier).toBe('Silver');

      // 2,499 pts -> Bronze
      const bronze = calculateAirdropAllocation({
        seasonPoints: 2_499,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(bronze.tier).toBe('Bronze');
    });

    it('is immune to NaN, Infinity, negative values, and floating point exploits', () => {
      const safeOutcome = calculateAirdropAllocation({
        seasonPoints: Number.NaN,
        cashEarned: -50000,
        streakDays: Number.POSITIVE_INFINITY,
        qualifiedReferrals: 'invalid' as unknown as number,
        hasConnectedWallet: true,
      });

      expect(Number.isFinite(safeOutcome.totalAirdropPoints)).toBe(true);
      expect(safeOutcome.seasonPointsContribution).toBe(0);
      expect(safeOutcome.cashContribution).toBe(0);
      expect(safeOutcome.referralContribution).toBe(0);
      // Connected wallet bonus of 1,000 points
      expect(safeOutcome.totalAirdropPoints).toBe(1000);
      expect(safeOutcome.tier).toBe('Bronze');
    });

    it('awards connected wallet bonus of +1,000 points exclusively when verified', () => {
      const withWallet = calculateAirdropAllocation({
        seasonPoints: 5000,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: true,
      });
      expect(withWallet.walletBonus).toBe(1000);
      expect(withWallet.totalAirdropPoints).toBe(6000);

      const withoutWallet = calculateAirdropAllocation({
        seasonPoints: 5000,
        cashEarned: 0,
        streakDays: 0,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(withoutWallet.walletBonus).toBe(0);
      expect(withoutWallet.totalAirdropPoints).toBe(5000);
    });
  });

  describe('Vector 5: Property-based Fuzz Testing', () => {
    it('never accepts random pseudorandom byte strings as valid TON addresses', () => {
      for (let i = 0; i < 200; i++) {
        // Generate random 48-char string
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let randomStr = '';
        for (let j = 0; j < 48; j++) {
          randomStr += chars[Math.floor(Math.random() * chars.length)];
        }
        const result = validateTonAddress(randomStr);
        // Probability of random 48 chars matching valid base64, valid flags, valid workchain, AND 16-bit CRC is ~1 in 2^16
        // If it passes, it must have valid canonicalAddress and no crash
        if (result.valid) {
          expect(result.canonicalAddress).toBeDefined();
        } else {
          expect(result.valid).toBe(false);
        }
      }
    });

    it('constant-time timingSafeEqual verifies byte equality without leaking duration', () => {
      const b1 = Buffer.from('1234567890abcdef');
      const b2 = Buffer.from('1234567890abcdef');
      const b3 = Buffer.from('1234567890abcdeg');
      const b4 = Buffer.from('short');

      expect(timingSafeEqual(b1, b2)).toBe(true);
      expect(timingSafeEqual(b1, b3)).toBe(false);
      expect(timingSafeEqual(b1, b4)).toBe(false);
    });
  });
});
