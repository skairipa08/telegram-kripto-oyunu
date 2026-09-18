import { describe, expect, it } from 'vitest';
import {
  calculateAirdropAllocation,
  generateTonProofNonce,
  validateTonAddress,
  verifyTonProofNonce,
} from './ton-wallet';

describe('Web3 & TON Wallet Security Suite', () => {
  describe('Vector 1: TON Address Validation & Invariants', () => {
    it('accepts valid mainnet bounceable (EQ...) and non-bounceable (UQ...) addresses', () => {
      // 48-character real-world format
      const bounceable = 'EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcACZq';
      const nonBounceable = 'UQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcACe_';

      const res1 = validateTonAddress(bounceable);
      expect(res1.valid).toBe(true);
      expect(res1.isBounceable).toBe(true);
      expect(res1.isTestnet).toBe(false);
      expect(res1.normalizedAddress).toBe(bounceable);

      const res2 = validateTonAddress(nonBounceable);
      expect(res2.valid).toBe(true);
      expect(res2.isBounceable).toBe(false);
      expect(res2.isTestnet).toBe(false);
    });

    it('accepts valid testnet (kQ... / 0Q...) addresses and marks isTestnet true', () => {
      const testnetAddr = 'kQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqOkejOtRFmcACZq';
      const res = validateTonAddress(testnetAddr);
      expect(res.valid).toBe(true);
      expect(res.isTestnet).toBe(true);
    });

    it('accepts valid raw hex format workchain:hash', () => {
      const raw = '0:6f5bc67986e06430961d9df00433926a4cd92e597ddd8aa3a47a33ad44599c00';
      const res = validateTonAddress(raw);
      expect(res.valid).toBe(true);
      expect(res.normalizedAddress).toBe(raw);
    });

    it('rejects all-zero raw addresses and invalid workchains', () => {
      const zeroAddr = '0:0000000000000000000000000000000000000000000000000000000000000000';
      const invalidWorkchain = '5:6f5bc67986e06430961d9df00433926a4cd92e597ddd8aa3a47a33ad44599c00';

      expect(validateTonAddress(zeroAddr).valid).toBe(false);
      expect(validateTonAddress(invalidWorkchain).valid).toBe(false);
    });

    it('rejects malformed, truncated, or injected addresses', () => {
      expect(validateTonAddress('').valid).toBe(false);
      expect(validateTonAddress('not_an_address').valid).toBe(false);
      expect(validateTonAddress('EQ_too_short').valid).toBe(false);
      expect(validateTonAddress('0x71C8451376372705556CA56041A6CE5B49E56A3E').valid).toBe(false); // Ethereum address
      expect(validateTonAddress('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA').valid).toBe(false); // Junk repetitive
    });
  });

  describe('Vector 2: Cryptographic Anti-Replay Nonce Engine', () => {
    const SECRET = 'test_secret_entropy_key_1234567890';
    const USER_ID = 'usr_test_player_42';

    it('generates a valid nonce and verifies it successfully within the allowed window', async () => {
      const now = 1700000000;
      const nonce = await generateTonProofNonce(USER_ID, SECRET, now);

      expect(nonce.startsWith(`tonproof_${USER_ID}_${now}_`)).toBe(true);

      const verification = await verifyTonProofNonce(
        nonce,
        USER_ID,
        SECRET,
        600,
        now + 30, // 30 seconds later
      );
      expect(verification.valid).toBe(true);
    });

    it('rejects nonces hijacked by another user (Anti-Identity-Theft)', async () => {
      const now = 1700000000;
      const nonce = await generateTonProofNonce(USER_ID, SECRET, now);

      const verification = await verifyTonProofNonce(
        nonce,
        'usr_attacker_99', // Different user ID
        SECRET,
        600,
        now + 10,
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('Anti-hijack');
    });

    it('rejects expired nonces older than max age (Anti-Replay)', async () => {
      const now = 1700000000;
      const nonce = await generateTonProofNonce(USER_ID, SECRET, now);

      const verification = await verifyTonProofNonce(
        nonce,
        USER_ID,
        SECRET,
        600, // 10 min window
        now + 601, // 10 min and 1 second later
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('süresi doldu');
    });

    it('rejects tampered nonces with invalid cryptographic signature', async () => {
      const now = 1700000000;
      const nonce = await generateTonProofNonce(USER_ID, SECRET, now);
      const tampered = nonce.slice(0, -4) + 'ffff';

      const verification = await verifyTonProofNonce(
        tampered,
        USER_ID,
        SECRET,
        600,
        now + 10,
      );
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('kriptografik imzası uyuşmuyor');
    });
  });

  describe('Vector 3: Airdrop Allocation Transparency & Anti-P2W Guarantees', () => {
    it('computes transparent airdrop points and tiering accurately', () => {
      const score = calculateAirdropAllocation({
        seasonPoints: 12500,
        cashEarned: 50_000_000,
        streakDays: 14,
        qualifiedReferrals: 5,
        hasConnectedWallet: true,
      });

      // 12500 SP
      // 50M / 10K = 5000 pts
      // 14 * 100 = 1400 pts
      // 5 * 250 = 1250 pts
      // wallet bonus = 1000 pts
      // Total = 12500 + 5000 + 1400 + 1250 + 1000 = 21150 pts
      expect(score.seasonPointsContribution).toBe(12500);
      expect(score.cashContribution).toBe(5000);
      expect(score.streakContribution).toBe(1400);
      expect(score.referralContribution).toBe(1250);
      expect(score.walletBonus).toBe(1000);
      expect(score.totalAirdropPoints).toBe(21150);
      expect(score.tier).toBe('Gold');
      expect(score.phase).toBe('preparation_soon');
      expect(score.isSnapshotTaken).toBe(false);
    });

    it('awards Diamond tier for top contributors (>= 50,000 pts)', () => {
      const diamondScore = calculateAirdropAllocation({
        seasonPoints: 45000,
        cashEarned: 60_000_000,
        streakDays: 30,
        qualifiedReferrals: 10,
        hasConnectedWallet: true,
      });
      expect(diamondScore.tier).toBe('Diamond');
    });

    it('awards 0 wallet bonus when wallet is not connected', () => {
      const noWallet = calculateAirdropAllocation({
        seasonPoints: 1000,
        cashEarned: 10_000,
        streakDays: 1,
        qualifiedReferrals: 0,
        hasConnectedWallet: false,
      });
      expect(noWallet.walletBonus).toBe(0);
      expect(noWallet.totalAirdropPoints).toBe(1000 + 1 + 100 + 0 + 0);
    });
  });
});
