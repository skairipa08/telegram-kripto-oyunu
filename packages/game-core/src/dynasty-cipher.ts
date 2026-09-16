/**
 * Dynasty Cipher Cyber-Hack Terminal Engine
 *
 * Mathematical models for:
 * - Dynamic sequence length scaling: L(r) = min(12, 3 + floor((r - 1) / 2))
 * - Combo streak multiplier: min(3.0, 1.0 + 0.25 * (c - 1))
 * - Cash payout scaling and daily earning caps
 */

import {
  DEFAULT_CIPHER_CONFIG,
  type DynastyCipherConfig,
} from './minigames-config';

export const CIPHER_SYMBOLS = ['α', 'β', 'γ', 'δ', 'λ', 'Ω', 'Ψ', 'Σ'] as const;

/**
 * Calculates sequence length for a given round.
 * Formula: min(12, 3 + floor((r - 1) / 2))
 */
export function calculateCipherSequenceLength(
  round: number,
  config: DynastyCipherConfig = DEFAULT_CIPHER_CONFIG,
): number {
  const r = Math.max(1, Math.floor(round));
  const rawLength = config.minSequenceLength + Math.floor((r - 1) / 2);
  return Math.min(config.maxSequenceLength, rawLength);
}

/**
 * Generates a pseudo-random cipher sequence for the terminal hack.
 */
export function generateCipherSequence(
  round: number,
  symbols: readonly string[] = CIPHER_SYMBOLS,
  rng: () => number = Math.random,
  config: DynastyCipherConfig = DEFAULT_CIPHER_CONFIG,
): string[] {
  const length = calculateCipherSequenceLength(round, config);
  const sequence: string[] = [];

  for (let i = 0; i < length; i++) {
    const idx = Math.floor(rng() * symbols.length);
    sequence.push(symbols[idx] ?? symbols[0]!);
  }

  return sequence;
}

/**
 * Calculates combo multiplier for consecutive perfect hacks.
 * Formula: min(3.0, 1.0 + 0.25 * (combo - 1))
 */
export function calculateComboMultiplier(
  combo: number,
  config: DynastyCipherConfig = DEFAULT_CIPHER_CONFIG,
): number {
  const c = Math.max(1, Math.floor(combo));
  const rawMult = 1.0 + 0.25 * (c - 1);
  return Math.min(config.maxComboMultiplier, Math.round(rawMult * 100) / 100);
}

export interface CipherRewardResult {
  rewardCash: number;
  comboMultiplier: number;
  sequenceLength: number;
  isCapped: boolean;
}

/**
 * Calculates reward Cash for completing a cipher round.
 * Formula: floor((base + step * (round - 1)) * comboMultiplier)
 */
export function calculateCipherReward(
  round: number,
  combo: number,
  currentDailyEarned: number = 0,
  config: DynastyCipherConfig = DEFAULT_CIPHER_CONFIG,
): CipherRewardResult {
  const r = Math.max(1, Math.floor(round));
  const sequenceLength = calculateCipherSequenceLength(r, config);
  const comboMultiplier = calculateComboMultiplier(combo, config);

  const baseCash = config.baseRewardCash + config.rewardPerRoundStep * (r - 1);
  const rawReward = Math.floor(baseCash * comboMultiplier);

  const remainingDailyCap = Math.max(
    0,
    config.dailyEarningCapCash - currentDailyEarned,
  );
  const rewardCash = Math.min(rawReward, remainingDailyCap);
  const isCapped = rawReward > remainingDailyCap;

  return {
    rewardCash,
    comboMultiplier,
    sequenceLength,
    isCapped,
  };
}
