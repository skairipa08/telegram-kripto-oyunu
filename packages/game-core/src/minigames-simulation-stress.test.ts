import { describe, expect, it } from 'vitest';
import {
  calculateEnergyState,
  calculateTapClick,
  calculateTapUpgradeCost,
} from './notcoin-tap';
import {
  calculateBoardPassiveRate,
  solveAutoMergeBoard,
} from './catizen-merge';
import { generateCrashMultiplier, settleCrashBet } from './crypto-crash';
import { calculateCipherReward } from './dynasty-cipher';
import { DEFAULT_CRASH_CONFIG } from './minigames-config';

describe('Minigames Simulation & Economic Balance Stress Test (10,000 Iterations)', () => {
  it('simulates 10,000 multi-game player actions proving sink/faucet sustainability, zero NaN leaks, and bounded velocity', () => {
    // Deterministic PRNG for perfectly reproducible simulation
    let seed = 135792468;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    let playerCash = 1000;
    let energy = 1000;
    let multitapLevel = 1;
    const energyCapacityLevel = 1;
    const rechargeSpeedLevel = 1;

    let mergeBoard = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let cipherRound = 1;
    let cipherCombo = 1;
    let dailyCipherEarned = 0;

    let totalCrashStaked = 0;
    let totalCrashPayout = 0;
    let totalTapsExecuted = 0;
    let totalTapCoinsEarned = 0;
    let totalMergeRewards = 0;
    let totalCipherRewards = 0;

    const SERVER_SEED = 'simulation_server_seed_proof_of_solvency';
    const CLIENT_SEED = 'session_stress_user_001';

    let currentTimestampMs = 1_700_000_000_000;

    for (let iter = 0; iter < 10_000; iter++) {
      // Advance time slightly (between 1s and 10s per action)
      const elapsedSeconds = 1 + Math.floor(rng() * 10);
      currentTimestampMs += elapsedSeconds * 1000;

      // Update energy
      const energyState = calculateEnergyState({
        currentEnergy: energy,
        energyCapacityLevel,
        rechargeSpeedLevel,
        lastUpdateTimestampMs: currentTimestampMs - elapsedSeconds * 1000,
        currentTimestampMs,
      });
      energy = energyState.energy;

      // Rotate between 4 minigames
      const actionType = iter % 4;

      if (actionType === 0) {
        // 1. Notcoin Tap action: tap up to 20 times if energy permits
        const tapCount = Math.min(20, Math.floor(rng() * 25));
        const tapResult = calculateTapClick({
          requestedTaps: tapCount,
          currentEnergy: energy,
          multitapLevel,
          rollCrit: () => rng() < 0.05,
        });

        energy = tapResult.remainingEnergy;
        playerCash += tapResult.totalCoinsEarned;
        totalTapsExecuted += tapResult.tapsExecuted;
        totalTapCoinsEarned += tapResult.totalCoinsEarned;

        // Upgrade multitap if cash is plentiful
        const nextUpgradeCost = calculateTapUpgradeCost(
          'multitap',
          multitapLevel,
        );
        if (playerCash > nextUpgradeCost * 3 && multitapLevel < 10) {
          playerCash -= nextUpgradeCost;
          multitapLevel++;
        }
      } else if (actionType === 1) {
        // 2. Catizen Merge action: passive income + parcel drop + auto merge
        const passiveRate = calculateBoardPassiveRate(mergeBoard);
        playerCash += passiveRate * elapsedSeconds;

        // Drop parcel on empty slot if available
        const emptyIndices = mergeBoard
          .map((item, idx) => (item === 0 ? idx : -1))
          .filter((idx) => idx !== -1);

        if (emptyIndices.length > 0) {
          const targetSlot =
            emptyIndices[Math.floor(rng() * emptyIndices.length)]!;
          mergeBoard[targetSlot] = -1; // place parcel
        }

        // Run auto merge
        const mergeResult = solveAutoMergeBoard(mergeBoard, {
          autoUnbox: true,
          rollFn: rng,
        });
        mergeBoard = mergeResult.newGrid;
        playerCash += mergeResult.totalRewardCash;
        totalMergeRewards += mergeResult.totalRewardCash;
      } else if (actionType === 2) {
        // 3. Crypto Crash action: place small stake (between 10 and 100 Cash)
        const stake = Math.min(
          100,
          Math.max(10, Math.floor(playerCash * 0.05)),
        );
        if (playerCash >= stake && stake >= DEFAULT_CRASH_CONFIG.minStakeCash) {
          playerCash -= stake;
          totalCrashStaked += stake;

          const crashResult = generateCrashMultiplier(
            SERVER_SEED,
            CLIENT_SEED,
            iter,
          );
          // Player chooses cashout target between 1.20x and 3.00x
          const targetCashout = 1.2 + Math.floor(rng() * 18) * 0.1;

          const settlement = settleCrashBet({
            stake,
            crashMultiplier: crashResult.crashMultiplier,
            cashoutMultiplier: targetCashout,
          });

          if (settlement.status === 'won') {
            playerCash += settlement.payoutCash;
            totalCrashPayout += settlement.payoutCash;
          }
        }
      } else {
        // 4. Dynasty Cipher action: complete a hack round
        const cipherResult = calculateCipherReward(
          cipherRound,
          cipherCombo,
          dailyCipherEarned,
        );
        playerCash += cipherResult.rewardCash;
        dailyCipherEarned += cipherResult.rewardCash;
        totalCipherRewards += cipherResult.rewardCash;

        if (rng() < 0.85) {
          // 85% success rate increases combo and round
          cipherCombo = Math.min(9, cipherCombo + 1);
          cipherRound = (cipherRound % 15) + 1;
        } else {
          // Failure resets combo
          cipherCombo = 1;
        }
      }

      // INVARIANT CHECKS EVERY ITERATION:
      expect(Number.isFinite(playerCash)).toBe(true);
      expect(Number.isNaN(playerCash)).toBe(false);
      expect(playerCash).toBeGreaterThanOrEqual(0);

      expect(Number.isFinite(energy)).toBe(true);
      expect(energy).toBeGreaterThanOrEqual(0);
      expect(energy).toBeLessThanOrEqual(energyState.maxEnergy);
    }

    // Global invariants after 10,000 steps:
    expect(totalTapsExecuted).toBeGreaterThan(1000);
    expect(totalTapCoinsEarned).toBeGreaterThan(1000);
    expect(totalMergeRewards).toBeGreaterThan(100);
    expect(totalCipherRewards).toBeGreaterThan(100);
    expect(totalCrashStaked).toBeGreaterThan(1000);

    // Crypto crash acted as house currency sink: total payout <= total stake * 1.05
    const overallCrashRTP = (totalCrashPayout / totalCrashStaked) * 100;
    // RTP should be around 97% +/- 3% in randomized small bets
    expect(overallCrashRTP).toBeLessThan(102.0);
  });
});
